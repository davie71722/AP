import { townshipAt, villageAt } from './boundaries';
// 地點與車輛基礎資料（規格書「八」）。座標皆為約略值。

export const TOWNSHIPS: Record<string, [number, number]> = {
  竹北: [24.839, 121.004],
  竹東: [24.736, 121.09],
  新埔: [24.826, 121.073],
  關西: [24.788, 121.177],
  湖口: [24.903, 121.044],
  新豐: [24.899, 120.983],
  芎林: [24.775, 121.095],
  橫山: [24.72, 121.116],
  北埔: [24.699, 121.057],
  寶山: [24.761, 120.986],
  峨眉: [24.687, 121.015],
  尖石: [24.704, 121.198],
  五峰: [24.636, 121.12],
};

/** 山區加成（分鐘） */
/**
 * 依「轄區分隊」給山區加成（分鐘）：同一鄉鎮山區深淺差很多，
 * 例如尖石分隊在嘉樂（近內灣，淺山），田埔在後山。
 */
export const MOUNTAIN_BONUS: Record<string, number> = {
  田埔: 25,
  花園: 20,
  五峰: 20,
  尖石: 5,
  橫山: 5,
  北埔: 5,
  峨眉: 5,
  關西: 5,
};

export interface FreewaySegment {
  id: string;
  road: '國1' | '國3';
  label: string;
  lat: number;
  lng: number;
  township: string;
}

// TODO: 國道路段座標為「區間中點」粗估值，須以實際交流道與里程校正；
//       亦須區分南下／北上（回程可能不同於去程）。
export const FREEWAY_SEGMENTS: FreewaySegment[] = [
  { id: 'n1-yangmei-hukou', road: '國1', label: '國1 楊梅－湖口', lat: 24.905, lng: 121.08, township: '湖口' },
  { id: 'n1-hukou-zhubei', road: '國1', label: '國1 湖口－竹北', lat: 24.865, lng: 121.022, township: '竹北' },
  { id: 'n1-zhubei-hsinchu', road: '國1', label: '國1 竹北－新竹', lat: 24.822, lng: 121.01, township: '竹北' },
  { id: 'n1-hsinchu-system', road: '國1', label: '國1 新竹－新竹系統', lat: 24.79, lng: 121.005, township: '寶山' },
  { id: 'n3-longtan-guanxi', road: '國3', label: '國3 龍潭－關西', lat: 24.83, lng: 121.17, township: '關西' },
  { id: 'n3-guanxi-zhulin', road: '國3', label: '國3 關西－竹林', lat: 24.79, lng: 121.12, township: '芎林' },
  { id: 'n3-zhulin-baoshan', road: '國3', label: '國3 竹林－寶山', lat: 24.765, lng: 121.04, township: '寶山' },
  { id: 'n3-baoshan-xiangshan', road: '國3', label: '國3 寶山－香山', lat: 24.75, lng: 120.985, township: '寶山' },
];

export interface Unit {
  name: string;
  brigade: string;
  township: string;
  address: string;
  phone: string;
  /** 分隊位置：依地址以 Google 地圖查得（2026-11）；五峰、花園、尖石、田埔地址為村鄰，僅對到村層級 */
  lat: number;
  lng: number;
  /** 常送醫院分區（同鄉鎮但送醫習慣不同的分隊才設定） */
  area?: string;
}

/** 新竹縣政府消防局局本部 */
export const FIRE_HQ = { name: '新竹縣政府消防局', address: '新竹縣竹北市光明五街 295 號', phone: '03-5513520' };

export const BRIGADES = ['第一大隊', '第二大隊', '第三大隊', '第四大隊'] as const;

/** 選車時的大隊順序：事發轄區所屬大隊排最上方，其餘依大隊順序 */
export function brigadeOrder(unit?: string | null): string[] {
  const own = FIRE_UNITS.find((u) => u.name === unit)?.brigade;
  return own ? [own, ...BRIGADES.filter((b) => b !== own)] : [...BRIGADES];
}

/** 某大隊的分隊：轄區分隊排第一 */
export function unitsOf(brigade: string, unit?: string | null) {
  const us = FIRE_UNITS.filter((u) => u.brigade === brigade);
  return [...us.filter((u) => u.name === unit), ...us.filter((u) => u.name !== unit)];
}

/** 各大隊部 */
export const BRIGADE_HQS: { name: string; address: string }[] = [
  { name: '第一大隊', address: '竹北市福興路757號' },
  { name: '第二大隊', address: '竹東鎮長安路77號' },
  { name: '第三大隊', address: '新埔鎮田新路660號4樓' },
  { name: '第四大隊', address: '寶山鄉雙園路一段6巷32號' },
];

export const FIRE_UNITS: Unit[] = [
  { name: '竹北', brigade: '第一大隊', township: '竹北', address: '竹北市福興路757號', phone: '03-5552922', lat: 24.8219, lng: 121.0114 },
  { name: '光明', brigade: '第一大隊', township: '竹北', address: '竹北市光明五街295號', phone: '03-5559119', lat: 24.8281, lng: 121.0111 },
  { name: '高鐵', brigade: '第一大隊', township: '竹北', address: '竹北市隘口二路189號', phone: '03-6670314', lat: 24.8049, lng: 121.0387 },
  { name: '豐田', brigade: '第一大隊', township: '竹北', address: '竹北市中正西路2075巷15弄6號', phone: '03-5566119', lat: 24.8412, lng: 120.9538 },
  { name: '新豐', brigade: '第一大隊', township: '新豐', address: '新豐鄉建興路二段788之1號', phone: '03-5593340', lat: 24.9008, lng: 120.9871 },
  { name: '山崎', brigade: '第一大隊', township: '新豐', address: '新豐鄉松林街10號', phone: '03-5576811', lat: 24.8684, lng: 120.9932, area: '山崎' },
  { name: '竹東', brigade: '第二大隊', township: '竹東', address: '竹東鎮中正路206號', phone: '03-5962066', lat: 24.7354, lng: 121.0933 },
  { name: '橫山', brigade: '第二大隊', township: '橫山', address: '橫山鄉新興街120號', phone: '03-5932475', lat: 24.717, lng: 121.1414 },
  { name: '五峰', brigade: '第二大隊', township: '五峰', address: '五峰鄉桃山村2鄰21號', phone: '03-5856320', lat: 24.5674, lng: 121.0943 },
  { name: '花園', brigade: '第二大隊', township: '五峰', address: '五峰鄉花園村1鄰6之1號', phone: '03-5851803', lat: 24.6461, lng: 121.1514 },
  { name: '尖石', brigade: '第二大隊', township: '尖石', address: '尖石鄉嘉樂村2鄰麥樹仁62號', phone: '03-5841014', lat: 24.7119, lng: 121.2039 },
  { name: '田埔', brigade: '第二大隊', township: '尖石', address: '尖石鄉秀巒村2鄰田埔71號', phone: '03-5847880', lat: 24.6403, lng: 121.28 },
  { name: '新埔', brigade: '第三大隊', township: '新埔', address: '新埔鎮田新路660號', phone: '03-5882187', lat: 24.8259, lng: 121.0731 },
  { name: '湖口', brigade: '第三大隊', township: '湖口', address: '湖口鄉成功路109號', phone: '03-5992454', lat: 24.9048, lng: 121.0435 },
  { name: '新工', brigade: '第三大隊', township: '湖口', address: '湖口鄉文化路188號', phone: '03-5981674', lat: 24.8719, lng: 121.0174, area: '新工' },
  { name: '芎林', brigade: '第三大隊', township: '芎林', address: '芎林鄉光明路1號', phone: '03-5921978', lat: 24.778, lng: 121.0765 },
  { name: '關西', brigade: '第三大隊', township: '關西', address: '關西鎮正義路146號', phone: '03-5872790', lat: 24.7951, lng: 121.1756 },
  { name: '二重', brigade: '第四大隊', township: '竹東', address: '竹東鎮中興路四段99號', phone: '03-5829233', lat: 24.7729, lng: 121.0489, area: '二重' },
  { name: '寶山', brigade: '第四大隊', township: '寶山', address: '寶山鄉雙園路二段288號', phone: '03-5204755', lat: 24.766, lng: 120.9911, area: '寶山' },
  { name: '北埔', brigade: '第四大隊', township: '北埔', address: '北埔鄉南興街66號', phone: '03-5804449', lat: 24.6989, lng: 121.0571 },
  { name: '峨眉', brigade: '第四大隊', township: '峨眉', address: '峨眉鄉峨眉街1之1號', phone: '03-5800684', lat: 24.6881, lng: 121.0217 },
];

export interface SupportSource {
  name: string;
  prefix: string;
  lat?: number;
  lng?: number;
  defaultEtaMin?: number;
}

export const SUPPORT_SOURCES: SupportSource[] = [
  { name: '新竹市支援', prefix: '新竹市', lat: 24.804, lng: 120.968 },
  { name: '桃園支援', prefix: '桃園', lat: 24.953, lng: 121.225 },
  { name: '苗栗支援', prefix: '苗栗', lat: 24.687, lng: 120.91 },
  { name: '民間救護車', prefix: '民間', defaultEtaMin: 20 },
];

/** 分隊出發點座標 */
export function unitCoord(u: Unit): [number, number] {
  return [u.lat, u.lng];
}

/**
 * 村里例外轄區：行政上屬某鄉鎮、實際由他鄉鎮分隊負責的村里。
 * 新增時也要用 villages.py 把該村里界線加入 hsinchu-towns.json。
 */
export const VILLAGE_OVERRIDES: { township: string; village: string; unit: string }[] = [
  { township: '橫山', village: '內灣村', unit: '尖石' },
];

/**
 * 事故現場的轄區分隊：先依鄉鎮界線判斷所在鄉鎮，再取該鄉鎮內最近的分隊
 * （竹北、新豐、湖口、竹東、五峰、尖石有多個分隊）；縣外（如新竹市）取全縣最近分隊。
 * 註：同鄉鎮多分隊的實際分界依消防局轄區劃分，此處以最近分隊近似。
 */
export function jurisdiction(lat: number, lng: number): Unit {
  const vil = villageAt(lat, lng);
  const ov = vil && VILLAGE_OVERRIDES.find((o) => o.township === vil.township && o.village === vil.name);
  if (ov) return FIRE_UNITS.find((u) => u.name === ov.unit)!;
  const tw = townshipAt(lat, lng);
  const candidates = tw ? FIRE_UNITS.filter((u) => u.township === tw) : [];
  const pool = candidates.length ? candidates : FIRE_UNITS;
  const k = Math.cos((lat * Math.PI) / 180);
  let best = pool[0];
  let bestD = Infinity;
  for (const u of pool) {
    const d = (u.lat - lat) ** 2 + ((u.lng - lng) * k) ** 2;
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

/** 轄區分隊對應的常送醫院分區（未設定則用鄉鎮） */
export function unitArea(u: Unit): string {
  return u.area ?? u.township;
}

/** 依座標判斷鄉鎮、轄區分隊與常送醫院分區 */
export function locate(lat: number, lng: number): { township: string; area: string; unit: string } {
  const u = jurisdiction(lat, lng);
  return { township: townshipAt(lat, lng) ?? u.township, area: unitArea(u), unit: u.name };
}

export function nearestTownship(lat: number, lng: number): string {
  let best = '竹北';
  let bestD = Infinity;
  for (const [name, [tl, tg]] of Object.entries(TOWNSHIPS)) {
    const d = (tl - lat) ** 2 + (tg - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}
