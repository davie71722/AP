import type { TraumaEntry } from './data/trauma';
import { narrative } from './data/narrative';
// 核心資料模型（對應規格書「三、資料模型」）

export type Color = 'R' | 'Y' | 'G' | 'K'; // 紅黃綠黑
export type TransportColor = 'R' | 'Y' | 'G';
/** 檢傷系統：START 四色（預設）或十秒檢傷 TST（P1／P2／P3／死亡） */
export type TriageSystem = 'START' | 'TST';
/** 紅傷 ABCD 分類：A 呼吸道、B 呼吸、C 循環、D 意識（Disability） */
export type RedClass = 'A' | 'B' | 'C' | 'D';
export type Level = 'heavy' | 'medium' | 'general'; // 重度級 / 中度級 / 一般級
export type County = '新竹縣' | '新竹市' | '桃園市' | '苗栗縣';

export type Cap = { R: number; Y: number; G: number };

export interface Hospital {
  id: string;
  name: string;
  short: string;
  county: County;
  level: Level;
  traumaLevel: Level;
  tags: string[]; // 'hazmat' | 'peds' | 'burn' | 'obstetric' ...
  lat: number;
  lng: number;
  capacity: Cap;
  capacityNight?: Cap;
  /** 地址 */
  address?: string;
  /** 送醫進度頁優先顯示的順序（未設定者收在「更多醫院」） */
  featured?: number;
}

export interface HospitalRuntime {
  used: Cap;
  selfPresented: Cap;
  bypass: boolean;
  /** 醫院負荷回報（護理人力、情緒）：0 正常、1 吃緊、2 滿載 */
  strain?: 0 | 1 | 2;
  travelAdjustMin: number;
  decon: boolean;
  /** 編輯模式調整後的容量（未設定則用靜態資料） */
  capacityOverride?: Cap;
}

export type PatientTag =
  | 'peds'
  | 'pregnant'
  | 'burn'
  | 'inhalation'
  | 'crush'
  | 'blast'
  | 'penetrating'
  | 'decontaminated';

export interface Patient {
  id: string;
  color: Color;
  /** 顯示代碼，例：紅3-A、黃2；TST：P1-3-A、P2-2（由 color、num、redClass 與檢傷系統產生） */
  label: string;
  /** 同色流水號 */
  num: number;
  /** 紅傷 ABCD 分類（僅紅傷） */
  redClass?: RedClass;
  /** 再檢傷前的原代碼（可多次） */
  prevLabels: string[];
  seq: number; // 建立順序
  tags: string[];
  /** waiting 待送｜sent 已後送（救護車或勤務車）｜left 自行離開 */
  status: 'waiting' | 'sent' | 'left';
  /** 由勤務車載走（非救護車） */
  byDuty?: boolean;
  hospitalId?: string;
  vehicleId?: string;
  sentAt?: number;
  /** 預估抵院時間（確認出發時計算，用於分散送醫） */
  arriveAt?: number;
  triageTagNo?: string;
  /** 後送官註解 */
  note?: string;
  /** 人形圖傷口 */
  wounds?: Wound[];
  /** 創傷標籤與院前處置 */
  trauma?: TraumaEntry[];
  history: { at: number; action: string }[];
}

/** 人形圖傷口（格式同「外傷人形圖傷口紀錄」模組） */
export interface Wound {
  /** 含左右的部位名稱，如「左中指背側」 */
  region: string;
  /** 擦傷、撕裂傷、挫傷、燙傷、截肢、感染 */
  type: string;
  /** 撕裂傷長度（cm，0＝未填） */
  cm: number;
  /** 燙傷度數 I／II／III（可空） */
  deg: string;
  /** 燙傷面積 %（0＝未填） */
  tbsa: number;
  /** 骨折型態：閉鎖性／開放性（可不填） */
  fx?: string;
  /** 標記點位置與分頁 */
  x: number;
  y: number;
  v: 'front' | 'back' | 'face' | 'hand' | 'foot';
}

/** 傷口 → 描述文字 */
export function woundText(w: Wound): string {
  if (w.type === '撕裂傷') return `${w.region} ${w.cm > 0 ? w.cm + 'cm ' : ''}撕裂傷`;
  if (w.type === '疑似骨折/脫臼' && w.fx) return `${w.region} ${w.fx}骨折`;
  if (w.type === '燙傷') return `${w.region} ${w.deg ? w.deg + '度 ' : ''}燙傷${w.tbsa > 0 ? ` (TBSA ${w.tbsa}%)` : ''}`;
  return `${w.region} ${w.type}`;
}

/** 病人的交接註解：傷勢併評估、人形圖傷口；處置予…。其他註解 */
export function injuryText(p: { wounds?: Wound[]; note?: string; trauma?: TraumaEntry[]; color?: Color }): string {
  return narrative(p.trauma, p.wounds, p.note, p.color);
}

export type VehicleStatus = 'enroute' | 'standby' | 'transport' | 'decon' | 'offline';

export interface Vehicle {
  id: string;
  name: string;
  unit: string; // 分隊名或支援來源
  source: 'county' | 'support';
  originLat: number;
  originLng: number;
  status: VehicleStatus;
  addedAt: number;
  etaToSceneMin?: number; // 自 addedAt 起算的到場分鐘
  returnAt?: number;
  trips: number;
  /** 人力：EMT-2（中級）與 EMTP（高級）人數 */
  emt2: number;
  emtp: number;
  contaminated?: boolean;
  lastHospitalId?: string;
  /** 第 1 輛到場車：留守現場（指揮／協助檢傷），不列入派遣 */
  held?: boolean;
  /** 曾被指定為第 1 輛到場車（只指定一次） */
  wasHeld?: boolean;
}

export interface IncidentLocation {
  kind: 'township' | 'freeway' | 'pin';
  label: string;
  lat: number;
  lng: number;
  /** 所在（或最近）鄉鎮，用於山區加成 */
  township?: string;
  /** 常送醫院分區（由轄區分隊決定，如「二重」） */
  area?: string;
  /** 轄區分隊 */
  unit?: string;
}

export interface Settings {
  loadMin: number;
  handoverMin: number;
  /** 車程依時段自動調整（尖峰、夜間、救護車走路肩）；關閉時用 trafficFactor 手動倍率 */
  trafficAuto: boolean;
  trafficFactor: number;
  greensPerVehicle: 1 | 2 | 3;
  /** 黃傷同車併載一位綠傷 */
  yellowPlusGreen: boolean;
  /** 第 1 輛到場的救護車留在現場協助檢傷與指揮，不先載送（大傷 SOP） */
  firstVehicleHold: boolean;
  /** 綠傷群送（巴士）提示；尚未實施，預設關閉 */
  groupTransport: boolean;
  longHaulMin: number;
  reserveVehicles: number;
  nightMode: boolean;
  /** 啟用醫院收治上限（預設否：只統計已後送牌數，不設上限） */
  useCapacity: boolean;
  /** 化災時救護車每趟返場後需除污（預設否） */
  hazmatVehicleDecon: boolean;
  /** 檢傷系統（預設 START 四色） */
  triageSystem: TriageSystem;
  /** 新增車輛的預設人力 */
  defaultEmt2: number;
  defaultEmtp: number;
}

export interface LogEntry {
  at: number;
  text: string;
}

export interface Incident {
  types: string[];
  location: IncidentLocation | null;
  startAt: number | null;
  settings: Settings;
  log: LogEntry[];
  /** 指揮節點時間（如「大隊抵達」） */
  milestones?: Record<string, number>;
}

export interface TravelEntry {
  go: number; // 現場 → 醫院（分鐘；離線為未含時段係數的基準值，即時為已含路況）
  back: number; // 醫院 → 現場
  source: 'online' | 'offline';
  /** 估計路程（公里），用於時段與走路肩判斷 */
  km?: number;
}

export interface TravelState {
  /** 現場 → 各醫院 */
  byHospital: Record<string, TravelEntry>;
  /** 各分隊／支援來源 → 現場（分鐘，即時查詢結果） */
  unitEta?: Record<string, number>;
  /** 查詢時的現場座標（地點變更即重查） */
  forKey?: string;
  updatedAt: number | null;
  source: 'online' | 'offline';
  error?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  loadMin: 5,
  handoverMin: 15,
  trafficAuto: true,
  trafficFactor: 1.0,
  greensPerVehicle: 2,
  yellowPlusGreen: true,
  firstVehicleHold: true,
  groupTransport: false,
  longHaulMin: 35,
  reserveVehicles: 0,
  nightMode: false,
  useCapacity: false,
  hazmatVehicleDecon: false,
  triageSystem: 'START',
  defaultEmt2: 2,
  defaultEmtp: 0,
};

export const COLOR_NAME: Record<Color, string> = { R: '紅', Y: '黃', G: '綠', K: '黑' };

export const TRIAGE_NAMES: Record<TriageSystem, Record<Color, string>> = {
  START: COLOR_NAME,
  TST: { R: 'P1', Y: 'P2', G: 'P3', K: '死亡' },
};
/** 按鈕副標 */
export const TRIAGE_SUB: Record<TriageSystem, Record<Color, string>> = {
  START: { R: '', Y: '', G: '', K: '' },
  TST: { R: '緊急', Y: '稍緩', G: '輕傷', K: '' },
};
export const TRIAGE_SYSTEM_NAME: Record<TriageSystem, string> = { START: 'START 四色', TST: '十秒檢傷 TST' };

export const RED_CLASSES: { id: RedClass; name: string; en: string }[] = [
  { id: 'A', name: '呼吸道', en: 'Airway' },
  { id: 'B', name: '呼吸', en: 'Breathing' },
  { id: 'C', name: '循環', en: 'Circulation' },
  { id: 'D', name: '意識', en: 'Disability' },
];
/** 紅傷派遣順序：A → B → C → D → 未分類 */
export const RED_CLASS_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

export function patientLabel(color: Color, num: number, redClass: RedClass | undefined, system: TriageSystem): string {
  const name = TRIAGE_NAMES[system][color];
  const sep = system === 'TST' ? '-' : '';
  return `${name}${sep}${num}${color === 'R' && redClass ? `-${redClass}` : ''}`;
}
export const LEVEL_NAME: Record<Level, string> = { heavy: '重度', medium: '中度', general: '一般' };

export const PATIENT_TAGS: { id: PatientTag; name: string }[] = [
  { id: 'peds', name: '兒童' },
  { id: 'pregnant', name: '孕婦' },
  { id: 'burn', name: '燒傷' },
  { id: 'inhalation', name: '吸入' },
  { id: 'crush', name: '擠壓' },
  { id: 'blast', name: '爆震' },
  { id: 'penetrating', name: '穿刺' },
  { id: 'decontaminated', name: '已除污' },
];

export const VEHICLE_STATUS_NAME: Record<VehicleStatus, string> = {
  enroute: '趕赴中',
  standby: '現場待命',
  transport: '運送中',
  decon: '待除污',
  offline: '離線',
};
