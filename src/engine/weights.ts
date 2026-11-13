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
    R: { heavy: 100, mediumTraumaHeavy: 95, medium: 45, general: 5 },
    Y: { heavy: 55, mediumTraumaHeavy: 80, medium: 80, general: 55 },
    G: { heavy: 10, mediumTraumaHeavy: 55, medium: 55, general: 80 },
  } as Record<TransportColor, Record<FitClass, number>>,
  /** 一般級但具外傷中度能力：黃傷改用此分數（創傷事件） */
  yellowGeneralTraumaMedium: 65,
  /**
   * 創傷事件的紅傷以 traumaLevel 判斷。
   * false（目前）：中醫大新竹這類「中度級但具外傷重度能力」醫院用 mediumTraumaHeavy（95），
   *   處置能力略低於完整重度級（100），再由距離與轄內偏好綜合評估。
   * true：視同重度級（100）。
   * 非創傷事件一律以 level 判斷。
   */
  redTraumaUsesTraumaLevel: false,
  /**
   * 縣市偏好：醫院會啟動重大外傷機制，紅傷優先送轄內（新竹縣）醫院。
   * 中醫大新竹（95 + 10）在距離相近時排在新竹市重度級（100 + 0）之前；
   * 新竹市醫院若近 5 分鐘以上則改送新竹市。新竹縣市適合醫院用完才轉桃園、苗栗。
   * 黃綠傷僅輕度偏好。
   */
  countyBonus: {
    R: { 新竹縣: 10, 新竹市: 0, 桃園市: -20, 苗栗縣: -20 },
    Y: { 新竹縣: 3, 新竹市: 0, 桃園市: -10, 苗栗縣: -10 },
    G: { 新竹縣: 3, 新竹市: 0, 桃園市: -10, 苗栗縣: -10 },
  } as Record<TransportColor, Record<string, number>>,
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
