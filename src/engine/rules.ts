import { INCIDENT_TYPE_BY_ID } from '../data/incidentTypes';
import type { Hospital, Patient, TransportColor } from '../types';

export interface BonusRule {
  key: string;
  value: number;
  cond?: { kind: 'color'; color: TransportColor } | { kind: 'patientTag'; tag: string };
  target: { kind: 'tag' | 'level' | 'traumaLevel'; value: string };
}

export interface CombinedRules {
  typeIds: string[];
  names: string[];
  trauma: boolean;
  bonuses: BonusRule[];
  patientTags: string[];
  dispatchRequires: string[];
  vehicleAfterTransport?: 'decon';
  alerts: string[];
  hazmat: boolean;
}

const COLOR_WORD: Record<string, TransportColor> = { red: 'R', yellow: 'Y', green: 'G' };

export function parseBonus(key: string, value: number): BonusRule | null {
  const parts = key.split('->');
  const targetStr = parts[parts.length - 1];
  const condStr = parts.length > 1 ? parts[0] : undefined;
  const [tk, tv] = targetStr.split(':');
  if (!tv || !['tag', 'level', 'traumaLevel'].includes(tk)) return null;
  let cond: BonusRule['cond'];
  if (condStr) {
    if (COLOR_WORD[condStr]) cond = { kind: 'color', color: COLOR_WORD[condStr] };
    else if (condStr.startsWith('patientTag:')) cond = { kind: 'patientTag', tag: condStr.slice(11) };
    else return null;
  }
  return { key, value, cond, target: { kind: tk as 'tag' | 'level' | 'traumaLevel', value: tv } };
}

/** 複合式災難疊加（規格書 5.3） */
export function combineRules(typeIds: string[]): CombinedRules {
  const types = typeIds.map((id) => INCIDENT_TYPE_BY_ID[id]).filter(Boolean);
  const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));
  const bonuses: BonusRule[] = [];
  for (const t of types) {
    for (const [k, v] of Object.entries(t.hospitalBonus)) {
      const r = parseBonus(k, v);
      if (r) bonuses.push(r);
    }
  }
  return {
    typeIds: types.map((t) => t.id),
    names: types.map((t) => t.name),
    // 未選任何類型時預設為創傷事件
    trauma: types.length === 0 ? true : types.some((t) => t.trauma),
    bonuses,
    patientTags: uniq(types.flatMap((t) => t.patientTags)),
    dispatchRequires: uniq(types.flatMap((t) => t.dispatchRequires)),
    vehicleAfterTransport: types.some((t) => t.vehicleAfterTransport === 'decon') ? 'decon' : undefined,
    alerts: uniq(types.flatMap((t) => t.alerts)),
    hazmat: types.some((t) => t.id === 'hazmat'),
  };
}

export function bonusApplies(
  rule: BonusRule,
  color: TransportColor,
  patientTags: string[],
  h: Hospital,
): boolean {
  if (rule.cond) {
    if (rule.cond.kind === 'color' && rule.cond.color !== color) return false;
    if (rule.cond.kind === 'patientTag' && !patientTags.includes(rule.cond.tag)) return false;
  }
  switch (rule.target.kind) {
    case 'tag':
      return h.tags.includes(rule.target.value);
    case 'level':
      return h.level === rule.target.value;
    case 'traumaLevel':
      return h.traumaLevel === rule.target.value;
  }
}

/** 未滿足 dispatchRequires 的標籤 */
export function missingRequirements(p: Pick<Patient, 'tags'>, rules: CombinedRules): string[] {
  return rules.dispatchRequires.filter((t) => !p.tags.includes(t));
}
