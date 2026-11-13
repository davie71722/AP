import raw from './hospitals.json';
import type { Hospital, HospitalRuntime } from '../types';

export const HOSPITAL_DB_META = {
  version: raw.version,
  source: raw.source,
  sourceUrl: raw.sourceUrl,
  updatedAt: raw.updatedAt,
  note: raw.note,
};

export const HOSPITALS: Hospital[] = raw.hospitals as Hospital[];

export const HOSPITAL_BY_ID: Record<string, Hospital> = Object.fromEntries(
  HOSPITALS.map((h) => [h.id, h]),
);

export const COUNTY_ORDER = ['新竹縣', '新竹市', '桃園市', '苗栗縣'] as const;

export function initialRuntime(h: Hospital): HospitalRuntime {
  return {
    used: { R: 0, Y: 0, G: 0 },
    selfPresented: { R: 0, Y: 0, G: 0 },
    bypass: false,
    travelAdjustMin: 0,
    // TODO: 各院除污能力待確認。暫以化災責任醫院（hazmat）預設具除污能力。
    decon: h.tags.includes('hazmat'),
  };
}

export function initialRuntimes(): Record<string, HospitalRuntime> {
  return Object.fromEntries(HOSPITALS.map((h) => [h.id, initialRuntime(h)]));
}

// TODO: 燒燙傷中心、高壓氧、兒科急重症、高危險妊娠的實際名單待確認，
//       目前僅以 hospitals.json 的 tags（burn / peds / obstetric）粗略表示。
