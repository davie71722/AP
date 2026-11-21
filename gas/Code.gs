/**
 * 竹縣大傷後送小幫手：Google Apps Script 後端（免費版，不需 Google 地圖金鑰）
 *
 * 提供：
 *  - 網頁：doGet 回傳 index.html（整個 App 放在 GAS 上時）
 *  - 地圖服務：api(req) ／ doPost
 *      { search: "竹北全聯" }               → { places: [{ name, address, lat, lng }] }
 *      { address: "竹北市光明五街295號" }    → { lat, lng, label }
 *      { resolve: "https://maps.app.goo.gl/…" } → { url }
 *      { origins: [{lat,lng}], destinations: [{lat,lng}] } → [{ originIndex, destinationIndex, duration: "123s", condition }]
 *  - 交接／多人同步：{ sync: 'create' | 'get' | 'put', room, key, rev, state }
 *      資料存在 CacheService（每次讀寫自動延長，6 小時無人使用才失效），以版本號避免互相覆蓋，
 *      合併（單一病人／車輛欄位以較新者為準）在 App 端完成。
 *
 * 使用 GAS 內建 Maps 服務與 UrlFetchApp，有每日額度：
 *  - 結果暫存在 CacheService（車程 10 分鐘、地點 6 小時），重複查詢不再耗用額度
 *  - 額度用完時回傳錯誤，App 會自動改用離線估算
 *
 * 選用：在「專案設定 → 指令碼屬性」新增 TOKEN，App 端 VITE_MAP_TOKEN 設相同值，
 * 未帶正確 TOKEN 的請求一律拒絕（降低網址外流被濫用的機會）。
 */

var ROUTE_CACHE_SEC = 600; // 車程暫存 10 分鐘（v2：含距離與不含路況車程）
var PLACE_CACHE_SEC = 21600; // 地點暫存 6 小時（CacheService 上限）
var MAX_ELEMENTS = 60; // 單次車程查詢上限（現場→24 家醫院約 24 筆）
// 搜尋範圍：新竹縣市及周邊（桃園南部、苗栗北部）
var BOUNDS = { south: 24.45, west: 120.6, north: 25.1, east: 121.45 };

function doGet() {
  try {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('竹縣大傷後送小幫手')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  } catch (err) {
    // 只當地圖服務使用（App 放在其他網站）時沒有 index.html
    return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'zhuxian-mci-map' })).setMimeType(
      ContentService.MimeType.JSON,
    );
  }
}

function doPost(e) {
  var body = e && e.postData ? e.postData.contents : '';
  return ContentService.createTextOutput(api(body)).setMimeType(ContentService.MimeType.JSON);
}

/** App 呼叫入口（google.script.run.api 或 doPost），一律回傳 JSON 字串 */
function api(reqText) {
  var req;
  try {
    req = typeof reqText === 'string' ? JSON.parse(reqText) : reqText;
  } catch (err) {
    return JSON.stringify({ error: 'bad_json' });
  }
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (token && req.token !== token) return JSON.stringify({ error: 'unauthorized' });
  try {
    if (typeof req.search === 'string') return JSON.stringify({ places: search_(req.search) });
    if (typeof req.address === 'string') {
      var p = search_(req.address)[0];
      return JSON.stringify(p ? { lat: p.lat, lng: p.lng, label: p.address } : { error: 'NOT_FOUND' });
    }
    if (typeof req.resolve === 'string') return JSON.stringify({ url: resolve_(req.resolve) });
    if (req.origins && req.destinations) return JSON.stringify(matrix_(req.origins, req.destinations));
    if (typeof req.sync === 'string') return JSON.stringify(sync_(req));
    return JSON.stringify({ error: 'unknown_request' });
  } catch (err) {
    return JSON.stringify({ error: String((err && err.message) || err) });
  }
}

/** 地址、店家、地標 → 最多 5 個候選地點 */
function search_(q) {
  q = String(q).slice(0, 200).trim();
  if (!q) return [];
  var cache = CacheService.getScriptCache();
  var key = 'g:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, q, Utilities.Charset.UTF_8));
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var r = Maps.newGeocoder()
    .setRegion('tw')
    .setLanguage('zh-TW')
    .setBounds(BOUNDS.south, BOUNDS.west, BOUNDS.north, BOUNDS.east)
    .geocode(q);
  var results = (r && r.results) || [];
  var places = results.slice(0, 5).map(function (x) {
    var types = x.types || [];
    var poi = types.indexOf('point_of_interest') >= 0 || types.indexOf('establishment') >= 0;
    // 只對到鄉鎮、村里等行政區或概略位置（沒有真的找到該地標）
    var area =
      types.indexOf('political') >= 0 ||
      types.indexOf('locality') >= 0 ||
      types.indexOf('administrative_area_level_3') >= 0 ||
      types.indexOf('administrative_area_level_4') >= 0;
    var approximate = area || (x.geometry && x.geometry.location_type === 'APPROXIMATE');
    var name = poi && x.address_components && x.address_components[0] ? x.address_components[0].long_name : q;
    return {
      name: name,
      address: x.formatted_address || '',
      lat: x.geometry.location.lat,
      lng: x.geometry.location.lng,
      approximate: !!approximate,
    };
  });
  cache.put(key, JSON.stringify(places), PLACE_CACHE_SEC);
  return places;
}

/** Google 地圖短網址 → 完整網址（只接受 Google 地圖網域） */
function resolve_(url) {
  if (!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//.test(url)) throw new Error('unsupported_url');
  for (var i = 0; i < 5; i++) {
    var res = UrlFetchApp.fetch(url, { followRedirects: false, muteHttpExceptions: true });
    var h = res.getAllHeaders();
    var loc = h.Location || h.location;
    if (!loc) break;
    url = /^https?:\/\//.test(loc) ? loc : url.replace(/^(https?:\/\/[^/]+).*$/, '$1') + loc;
  }
  return url;
}

/** 車程矩陣：逐一查行車路線（含即時路況時用 duration_in_traffic） */
function matrix_(origins, destinations) {
  if (origins.length * destinations.length > MAX_ELEMENTS) throw new Error('too_many_elements');
  var cache = CacheService.getScriptCache();
  var out = [];
  for (var i = 0; i < origins.length; i++) {
    for (var j = 0; j < destinations.length; j++) {
      var o = origins[i];
      var d = destinations[j];
      var key = 'r2:' + o.lat.toFixed(3) + ',' + o.lng.toFixed(3) + '>' + d.lat.toFixed(3) + ',' + d.lng.toFixed(3);
      var c = cache.get(key);
      var r;
      if (c !== null) {
        r = c === '' ? null : JSON.parse(c);
      } else {
        r = route_(o, d);
        cache.put(key, r === null ? '' : JSON.stringify(r), ROUTE_CACHE_SEC);
      }
      if (r === null) {
        out.push({ originIndex: i, destinationIndex: j, condition: 'ROUTE_NOT_FOUND' });
      } else {
        var el = { originIndex: i, destinationIndex: j, duration: r.sec + 's', distanceMeters: r.meters, condition: 'ROUTE_EXISTS' };
        if (r.staticSec !== null) el.staticDuration = r.staticSec + 's';
        out.push(el);
      }
    }
  }
  return out;
}

function route_(o, d) {
  var r = Maps.newDirectionFinder()
    .setOrigin(o.lat, o.lng)
    .setDestination(d.lat, d.lng)
    .setMode(Maps.DirectionFinder.Mode.DRIVING)
    .setDepart(new Date())
    .setLanguage('zh-TW')
    .setRegion('tw')
    .getDirections();
  var leg = r && r.routes && r.routes[0] && r.routes[0].legs && r.routes[0].legs[0];
  if (!leg || !leg.duration) return null;
  var traffic = leg.duration_in_traffic ? leg.duration_in_traffic.value : null;
  return {
    sec: traffic !== null ? traffic : leg.duration.value, // 含路況（有的話）
    staticSec: traffic !== null ? leg.duration.value : null, // 不含路況（有路況資料時才回傳）
    meters: leg.distance ? leg.distance.value : null,
  };
}

/** 部署前在編輯器執行一次：授權並確認地圖服務可用 */
function test() {
  Logger.log(api(JSON.stringify({ search: '東元綜合醫院 竹北' })));
  Logger.log(api(JSON.stringify({ origins: [{ lat: 24.839, lng: 121.004 }], destinations: [{ lat: 24.8275, lng: 121.0128 }] })));
}

// ---------------- 交接／多人同步 ----------------
var ROOM_SEC = 21600; // CacheService 上限 6 小時；有人在用就會一直延長
var CHUNK = 25000; // 每段字元數（中文 UTF-8 約 3 bytes，單筆上限 100KB）

function rid_(n) {
  var a = 'abcdefghijkmnpqrstuvwxyz23456789';
  var s = '';
  for (var i = 0; i < n; i++) s += a.charAt(Math.floor(Math.random() * a.length));
  return s;
}

function roomLoad_(cache, room) {
  var m = cache.get('room:' + room);
  if (!m) return null;
  var meta = JSON.parse(m);
  var keys = [];
  for (var i = 0; i < meta.n; i++) keys.push('room:' + room + ':' + i);
  var parts = cache.getAll(keys);
  var text = '';
  for (var j = 0; j < keys.length; j++) {
    if (parts[keys[j]] === undefined || parts[keys[j]] === null) return null;
    text += parts[keys[j]];
  }
  meta.state = text;
  return meta;
}

function roomSave_(cache, room, meta, text) {
  var put = {};
  var n = Math.max(1, Math.ceil(text.length / CHUNK));
  for (var i = 0; i < n; i++) put['room:' + room + ':' + i] = text.slice(i * CHUNK, (i + 1) * CHUNK);
  put['room:' + room] = JSON.stringify({ editKey: meta.editKey, viewKey: meta.viewKey, rev: meta.rev, n: n, saved: Date.now() });
  cache.putAll(put, ROOM_SEC);
}

function sync_(req) {
  var cache = CacheService.getScriptCache();
  var url = '';
  try {
    url = ScriptApp.getService().getUrl();
  } catch (e) {}
  if (req.sync === 'create') {
    var room = rid_(8);
    var meta = { editKey: rid_(10), viewKey: rid_(10), rev: 1 };
    roomSave_(cache, room, meta, JSON.stringify(req.state || {}));
    return { room: room, editKey: meta.editKey, viewKey: meta.viewKey, rev: 1, role: 'edit', url: url };
  }
  var room = String(req.room || '');
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var cur = roomLoad_(cache, room);
    if (!cur) return { error: 'room_not_found' };
    var role = req.key === cur.editKey ? 'edit' : req.key === cur.viewKey ? 'view' : '';
    if (!role) return { error: 'bad_key' };
    var keys = role === 'edit' ? { editKey: cur.editKey, viewKey: cur.viewKey } : {};
    if (req.sync === 'get') {
      // 有人在看就延長保存
      if (Date.now() - (cur.saved || 0) > 1800000) roomSave_(cache, room, cur, cur.state);
      if (req.rev === cur.rev) return { rev: cur.rev, role: role, url: url, keys: keys };
      return { rev: cur.rev, role: role, url: url, keys: keys, state: JSON.parse(cur.state) };
    }
    if (req.sync === 'put') {
      if (role !== 'edit') return { error: 'read_only' };
      // 版本不符：回傳最新狀態，由 App 合併後重送
      if (req.rev !== cur.rev) return { conflict: true, rev: cur.rev, role: role, state: JSON.parse(cur.state) };
      cur.rev += 1;
      roomSave_(cache, room, cur, JSON.stringify(req.state || {}));
      return { rev: cur.rev, role: role };
    }
    return { error: 'unknown_sync' };
  } finally {
    lock.releaseLock();
  }
}
