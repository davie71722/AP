// Google 地圖代理（Cloudflare Worker）：Routes API 車程矩陣、地址查座標、短網址展開
//
// 部署：
//   npx wrangler secret put GOOGLE_MAPS_API_KEY     # 金鑰只存在這裡（需開放 Routes API、Geocoding API）
//   設定 ALLOWED_ORIGIN 環境變數為前端網址（例如 https://mci.example.gov.tw）
//   npx wrangler deploy proxy/cloudflare-worker.js --name zhuxian-mci-routes
//
// 金鑰建議：以單位／專案帳號申請，只開放 Routes API，並在 Cloud Console 設每日上限與預算警示。

const FIELD_MASK = 'originIndex,destinationIndex,duration,distanceMeters,status,condition';
const MAX_ELEMENTS = 625;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed || origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    if (allowed && origin !== allowed) return new Response('Forbidden', { status: 403, headers: cors });

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad JSON', { status: 400, headers: cors });
    }
    // 地址 → 座標（Google Geocoding API）
    if (body && typeof body.address === 'string') {
      const q = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      q.searchParams.set('address', body.address.slice(0, 200));
      q.searchParams.set('region', 'tw');
      q.searchParams.set('language', 'zh-TW');
      q.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);
      const r = await fetch(q);
      const j = await r.json();
      const top = j.results && j.results[0];
      const out = top
        ? { lat: top.geometry.location.lat, lng: top.geometry.location.lng, label: top.formatted_address }
        : { error: j.status || 'NOT_FOUND' };
      return new Response(JSON.stringify(out), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Google 地圖短網址 → 完整網址（只允許 Google 地圖網域）
    if (body && typeof body.resolve === 'string') {
      let url = body.resolve;
      if (!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//.test(url)) {
        return new Response('Unsupported URL', { status: 400, headers: cors });
      }
      for (let i = 0; i < 5; i++) {
        const r = await fetch(url, { redirect: 'manual' });
        const loc = r.headers.get('Location');
        if (!loc) break;
        url = new URL(loc, url).toString();
      }
      return new Response(JSON.stringify({ url }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { origins, destinations } = body || {};
    const valid = (a) =>
      Array.isArray(a) && a.length > 0 && a.every((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
    if (!valid(origins) || !valid(destinations) || origins.length * destinations.length > MAX_ELEMENTS) {
      return new Response('Invalid origins/destinations', { status: 400, headers: cors });
    }
    const wp = (p) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });
    const upstream = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        origins: origins.map(wp),
        destinations: destinations.map(wp),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
