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
  二重: { lat: 24.7905, lng: 121.039, township: '竹東', label: '二重' },
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
  brigade: string;
  township: string;
  address: string;
  phone: string;
  /** 分隊位置（TODO：依地址估計之約略值，請以 Google Maps 校正） */
  lat: number;
  lng: number;
  /** 分隊轄區（在地常送醫院用；未設定則用鄉鎮） */
  area?: string;
}

/** 新竹縣政府消防局局本部 */
export const FIRE_HQ = { name: '新竹縣政府消防局', address: '新竹縣竹北市光明五街 295 號', phone: '03-5513520' };

export const BRIGADES = ['第一大隊', '第二大隊', '第三大隊', '第四大隊'] as const;

export const FIRE_UNITS: Unit[] = [
  { name: '竹北', brigade: '第一大隊', township: '竹北', address: '竹北市福興路 757 號', phone: '03-5552922', lat: 24.8445, lng: 121.0105 },
  { name: '光明', brigade: '第一大隊', township: '竹北', address: '竹北市光明五街 295 號', phone: '03-5559119', lat: 24.826, lng: 121.015 },
  { name: '高鐵', brigade: '第一大隊', township: '竹北', address: '竹北市隘口二路 189 號', phone: '03-6670314', lat: 24.8105, lng: 121.042 },
  { name: '豐田', brigade: '第一大隊', township: '竹北', address: '竹北市中正西路 2075 巷 6 號', phone: '03-5566119', lat: 24.862, lng: 120.985 },
  { name: '新豐', brigade: '第一大隊', township: '新豐', address: '新豐鄉重興村建興路二段 788 之 1 號', phone: '03-5593340', lat: 24.898, lng: 120.989 },
  { name: '山崎', brigade: '第一大隊', township: '新豐', address: '新豐鄉松林村松林街 10 號', phone: '03-5576811', lat: 24.874, lng: 121.01 },
  { name: '竹東', brigade: '第二大隊', township: '竹東', address: '竹東鎮雞林里中正路 206 號', phone: '03-5962066', lat: 24.737, lng: 121.091 },
  { name: '芎林', brigade: '第二大隊', township: '芎林', address: '芎林鄉光明路 1 號', phone: '03-5921978', lat: 24.775, lng: 121.094 },
  { name: '橫山', brigade: '第二大隊', township: '橫山', address: '橫山鄉新興村新興街 120 號', phone: '03-5932475', lat: 24.7175, lng: 121.116 },
  { name: '五峰', brigade: '第二大隊', township: '五峰', address: '五峰鄉桃山村 2 鄰 21 號', phone: '03-5856320', lat: 24.598, lng: 121.125 },
  { name: '花園', brigade: '第二大隊', township: '五峰', address: '五峰鄉花園村 1 鄰 6-1 號', phone: '03-5851803', lat: 24.664, lng: 121.148 },
  { name: '尖石', brigade: '第二大隊', township: '尖石', address: '尖石鄉嘉樂村 2 鄰麥樹仁 62 號', phone: '03-5841014', lat: 24.704, lng: 121.199 },
  { name: '田埔', brigade: '第二大隊', township: '尖石', address: '尖石鄉秀巒村 2 鄰田埔 71 號', phone: '03-5847880', lat: 24.615, lng: 121.285 },
  { name: '新埔', brigade: '第三大隊', township: '新埔', address: '新埔鎮田新路 660 號', phone: '03-5882187', lat: 24.83, lng: 121.078 },
  { name: '湖口', brigade: '第三大隊', township: '湖口', address: '湖口鄉信勢村成功路 109 號', phone: '03-5992454', lat: 24.902, lng: 121.043 },
  { name: '新工', brigade: '第三大隊', township: '湖口', address: '湖口鄉鳳凰村文化路 188 號', phone: '03-5981674', lat: 24.878, lng: 121.058 },
  { name: '關西', brigade: '第三大隊', township: '關西', address: '關西鎮正義路 146 號', phone: '03-5872790', lat: 24.79, lng: 121.176 },
  { name: '二重', brigade: '第四大隊', township: '竹東', address: '竹東鎮中興路四段 99 號', phone: '03-5829233', lat: 24.7905, lng: 121.039, area: '二重' },
  { name: '寶山', brigade: '第四大隊', township: '寶山', address: '寶山鄉雙園路二段 288 號', phone: '03-5204755', lat: 24.759, lng: 120.983, area: '寶山' },
  { name: '北埔', brigade: '第四大隊', township: '北埔', address: '北埔鄉南興村南興街 66 號', phone: '03-5804449', lat: 24.699, lng: 121.057 },
  { name: '峨眉', brigade: '第四大隊', township: '峨眉', address: '峨眉鄉峨眉村峨眉街 1 號之 1', phone: '03-5800684', lat: 24.687, lng: 121.015 },
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
