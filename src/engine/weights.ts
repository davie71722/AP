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

export interface AreaRule {
  hospitals: string[];
  colors?: TransportColor[];
}

function AREA_ZHUDONG(): AreaRule[] {
  return [
    { hospitals: ['vgh-hc', 'ntu-bio-zd'], colors: ['Y', 'G'] },
    { hospitals: ['tungyuan'], colors: ['R'] },
  ];
}

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
  /**
   * 在地常送醫院（各分隊實務送醫習慣）：依事發轄區加 areaPreferredBonus 分。
   * colors 省略＝各色適用。仍須級別適合（例如紅傷不會因此送一般級）。
   * 列為常送的外縣市醫院（如關西→國軍桃園）不扣縣市偏好分，並可列入第一層。
   */
  areaPreferred: {
    竹北: [{ hospitals: ['tungyuan', 'cmuh-hc', 'ntu-bio-zb'] }],
    新埔: [{ hospitals: ['tungyuan', 'cmuh-hc', 'ntu-bio-zb'] }],
    新豐: [{ hospitals: ['cmuh-hc', 'renci'] }],
    山崎: [{ hospitals: ['tungyuan', 'cmuh-hc'] }],
    湖口: [{ hospitals: ['renci', 'tungyuan'] }],
    新工: [{ hospitals: ['tungyuan', 'renci'] }],
    關西: [{ hospitals: ['af-ty', 'ntu-bio-zb'] }],
    寶山: [{ hospitals: ['mackay-hc'] }],
    二重: [{ hospitals: ['mackay-hc'] }],
    // 竹東與山區：輕症送竹東兩院，重症送東元
    竹東: AREA_ZHUDONG(),
    橫山: AREA_ZHUDONG(),
    尖石: AREA_ZHUDONG(),
    五峰: AREA_ZHUDONG(),
  } as Record<string, AreaRule[]>,
  areaPreferredBonus: 15,
  /**
   * 分散送醫（發牌）：同一家醫院在「預計抵院時間前後 surgeWindowMin 分鐘內」
   * 每已有 1 位同色傷患抵達扣 surgeSameColor[色] 分、其他顏色扣 surgeOtherColor 分，
   * 讓傷患輪流分到各院，避免短時間塞爆同一家急診。
   * 綠傷分散權重較低，避免為了分散而把輕傷送到重度級醫院。
   */
  surgeWindowMin: 30,
  surgeSameColor: { R: 20, Y: 8, G: 3 } as Record<TransportColor, number>,
  surgeOtherColor: 3,
  /**
   * 累積收治（護理人力與情緒）：整個事件中該院每已收 1 位同色傷患扣 cumulative[色] 分，
   * 他色每位扣 cumulativeOther 分。床位還夠也會適時分流，紅傷以發牌方式輪送。
   */
  cumulative: { R: 15, Y: 6, G: 4 } as Record<TransportColor, number>,
  cumulativeOther: 1,
  /** 醫院負荷回報：吃緊／爆量扣分 */
  strainPenalty: [0, 20, 50] as number[],
  /** 以縣市內醫院為主：第一層只在這些縣市中、級別適合的醫院之間分配 */
  localCounties: ['新竹縣', '新竹市'] as string[],
  /** 第一層「級別適合」門檻（適配分）：紅傷＝重度／外傷重度、黃傷＝各級、綠傷＝中度／一般 */
  localTierMinFit: 50,
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
