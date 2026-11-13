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

/**
 * 鄉鎮內的分隊轄區（與鄉鎮中心差距大、送醫習慣不同者）。
 * TODO: 座標為約略值，請以 Google Maps 校正。
 */
export const AREAS: Record<string, { lat: number; lng: number; township: string; label: string }> = {
  二重: { lat: 24.783, lng: 121.04, township: '竹東', label: '二重（竹東）' },
};

/** 山區加成（分鐘） */
export const MOUNTAIN_BONUS: Record<string, number> = {
  尖石: 20,
  五峰: 20,
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
  township: string;
  /** 分隊所在地（未設定則用鄉鎮中心） */
  area?: string;
}

// TODO: 分隊名單待消防局確認實際編制。
export const FIRE_UNITS: Unit[] = [
  { name: '竹北', township: '竹北' },
  { name: '光明', township: '竹北' },
  { name: '六家', township: '竹北' },
  { name: '高鐵', township: '竹北' },
  { name: '新豐', township: '新豐' },
  { name: '山崎', township: '新豐' },
  { name: '湖口', township: '湖口' },
  { name: '新工', township: '湖口' },
  { name: '新埔', township: '新埔' },
  { name: '關西', township: '關西' },
  { name: '竹東', township: '竹東' },
  { name: '二重', township: '竹東', area: '二重' },
  { name: '芎林', township: '芎林' },
  { name: '橫山', township: '橫山' },
  { name: '寶山', township: '寶山' },
  { name: '北埔', township: '北埔' },
  { name: '峨眉', township: '峨眉' },
  { name: '尖石', township: '尖石' },
  { name: '五峰', township: '五峰' },
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
  if (u.area && AREAS[u.area]) return [AREAS[u.area].lat, AREAS[u.area].lng];
  return TOWNSHIPS[u.township];
}

/** 最近的轄區（含 AREAS），回傳 { township, area } */
export function nearestArea(lat: number, lng: number): { township: string; area: string } {
  const tw = nearestTownship(lat, lng);
  let best = { township: tw, area: tw };
  const [tl, tg] = TOWNSHIPS[tw];
  let bestD = (tl - lat) ** 2 + (tg - lng) ** 2;
  for (const [name, a] of Object.entries(AREAS)) {
    const d = (a.lat - lat) ** 2 + (a.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { township: a.township, area: name };
    }
  }
  return best;
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
