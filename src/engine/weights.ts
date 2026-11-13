// 分配演算權重（規格書 6.2）。全部集中於此，Phase 4 以桌上推演與過去案例校正。
import type { TransportColor } from '../types';

/**
 * 醫院類別：
 *  heavy              重度級
 *  mediumTraumaHeavy  中度級但具緊急外傷重度能力（如中醫大新竹）
 *  medium             中度級
 *  general            一般級
 */
export type FitClass = 'heavy' | 'mediumTraumaHeavy' | 'medium' | 'general';

export const WEIGHTS = {
  /** 級別適配表 */
  fit: {
    R: { heavy: 100, mediumTraumaHeavy: 85, medium: 45, general: 5 },
    Y: { heavy: 55, mediumTraumaHeavy: 80, medium: 80, general: 55 },
    G: { heavy: 10, mediumTraumaHeavy: 55, medium: 55, general: 80 },
  } as Record<TransportColor, Record<FitClass, number>>,
  /** 一般級但具外傷中度能力：黃傷改用此分數（創傷事件） */
  yellowGeneralTraumaMedium: 65,
  /**
   * 創傷事件的紅傷以 traumaLevel 判斷（規格 4.2：具外傷重度能力者紅傷視同重度級）。
   * true：中醫大新竹這類醫院在創傷事件紅傷以 heavy（100）計；
   * false：改用表中「中度（外傷重度能力）」欄位（85）。
   * 非創傷事件一律以 level 判斷。
   */
  redTraumaUsesTraumaLevel: true,
  /** 車程權重（每分鐘扣分） */
  travel: { R: 1.0, Y: 1.1, G: 1.4 } as Record<TransportColor, number>,
  /** 負載懲罰：25 × 已用量 / 總量 */
  loadPenalty: 25,
  /** 長程懲罰 */
  longHaul: { R: 5, Y: 15, G: 15 } as Record<TransportColor, number>,
  /** 病人標籤加分 */
  pedsTag: 35,
  pedsHeavyNoTag: 10,
  burnTag: 45,
  pregnantHeavy: 15,
  pregnantObstetric: 15,
  /** 車輛可用時間 ≤ 此分鐘視為「已在現場」，可確認出發 */
  onSceneToleranceMin: 0.5,
};
