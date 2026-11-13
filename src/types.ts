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
}

export interface HospitalRuntime {
  used: Cap;
  selfPresented: Cap;
  bypass: boolean;
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
  status: 'waiting' | 'sent';
  hospitalId?: string;
  vehicleId?: string;
  sentAt?: number;
  triageTagNo?: string;
  history: { at: number; action: string }[];
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
}

export interface IncidentLocation {
  kind: 'township' | 'freeway' | 'pin';
  label: string;
  lat: number;
  lng: number;
  /** 所在（或最近）鄉鎮，用於山區加成 */
  township?: string;
}

export interface Settings {
  loadMin: number;
  handoverMin: number;
  trafficFactor: number;
  greensPerVehicle: 1 | 2 | 3;
  longHaulMin: number;
  reserveVehicles: number;
  nightMode: boolean;
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
}

export interface TravelEntry {
  go: number; // 現場 → 醫院（分鐘，未含倍率與修正）
  back: number; // 醫院 → 現場
  source: 'online' | 'offline';
}

export interface TravelState {
  byHospital: Record<string, TravelEntry>;
  updatedAt: number | null;
  source: 'online' | 'offline';
  error?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  loadMin: 5,
  handoverMin: 15,
  trafficFactor: 1.0,
  greensPerVehicle: 2,
  longHaulMin: 35,
  reserveVehicles: 0,
  nightMode: false,
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
