import { useMemo } from 'react';
import { HOSPITALS } from '../data/hospitals';
import { computePlan } from '../engine/plan';
import { combineRules } from '../engine/rules';
import { useStore } from './store';
import { TRIAGE_NAMES, TRIAGE_SUB } from '../types';

export function useRules() {
  const types = useStore((s) => s.incident.types);
  return useMemo(() => combineRules(types), [types]);
}

/** 每次狀態改變或時鐘 tick 時重新計算建議（不改變真實狀態） */
export function usePlan() {
  const rules = useRules();
  const now = useStore((s) => s.now);
  const patients = useStore((s) => s.patients);
  const vehicles = useStore((s) => s.vehicles);
  const runtime = useStore((s) => s.runtime);
  const travel = useStore((s) => s.travel.byHospital);
  const settings = useStore((s) => s.incident.settings);
  return useMemo(
    () => computePlan({ now, patients, vehicles, hospitals: HOSPITALS, runtime, travel, settings, rules }),
    [now, patients, vehicles, runtime, travel, settings, rules],
  );
}

/** 目前檢傷系統與各色顯示名稱 */
export function useTriage() {
  const sys = useStore((s) => s.incident.settings.triageSystem);
  return { sys, names: TRIAGE_NAMES[sys], sub: TRIAGE_SUB[sys] };
}
