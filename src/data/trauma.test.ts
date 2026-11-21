import { describe, expect, it } from 'vitest';
import { actText, keyFlags, TQ, traumaText } from './trauma';
import { injuryText } from '../types';

describe('創傷與處置註解（規格書範例）', () => {
  it('單一傷勢：名稱，狀態、處置。', () => {
    expect(traumaText([{ id: 'r-head', name: '重度頭部外傷', acts: ['意識不清', '瞳孔不等大', '已插氣管內管', 'BVM給氧'] }])).toBe(
      '重度頭部外傷，意識不清、瞳孔不等大，已插氣管內管、BVM給氧。',
    );
  });
  it('多重傷勢以；分隔，止血帶自動帶入時間', () => {
    const t = new Date(2026, 10, 21, 14, 25).getTime();
    expect(actText(TQ, t)).toBe('已上止血帶(14:25)');
    const list = [
      { id: 'r-ptx', name: '氣胸/血胸', acts: ['已針刺減壓(左)', 'NRM給氧'] },
      { id: 'r-art', name: '動脈大出血', acts: [actText(TQ, t), '已打雙線IV', '已輸血'] },
    ];
    expect(traumaText(list)).toBe('氣胸/血胸，已針刺減壓(左)、NRM給氧；動脈大出血，已上止血帶(14:25)、已打雙線IV、已輸血。');
    expect(keyFlags(list)).toEqual(['針刺減壓(左)', '止血帶 14:25', '輸血']);
  });
  it('綠牌「可搭坐車」以逗號另接', () => {
    expect(traumaText([{ id: 'g-abr', name: '表淺擦傷/挫傷', acts: ['NS清洗傷口', '已貼敷料/紗布', '可搭坐車'] }])).toBe(
      '表淺擦傷/挫傷，NS清洗傷口、已貼敷料/紗布，可搭坐車。',
    );
  });
  it('依按鈕順序；狀態與處置以，分隔', () => {
    expect(traumaText([{ id: 'r-abd', name: '腹部嚴重創傷', acts: ['已輸血', '疑內出血/休克', '已給Transamin', '已打雙線IV'] }])).toBe(
      '腹部嚴重創傷，疑內出血/休克，已打雙線IV、已給Transamin、已輸血。',
    );
    expect(traumaText([{ id: 'g-lac', name: '小面積撕裂傷(已止血)', acts: ['可搭坐車', '已加壓止血包紮', '行走無礙'] }])).toBe(
      '小面積撕裂傷(已止血)，已加壓止血包紮、行走無礙，可搭坐車。',
    );
  });
  it('只點創傷不點處置', () => {
    expect(traumaText([{ id: 'r-pelvis', name: '不穩定骨盆骨折', acts: [] }])).toBe('不穩定骨盆骨折。');
  });
  it('與人形圖、註解合併', () => {
    expect(
      injuryText({ trauma: [{ id: 'y-fx', name: '單一肢體骨折/脫臼', acts: ['已副木/夾板固定'] }], note: '酒味' }),
    ).toBe('單一肢體骨折/脫臼，已副木/夾板固定。酒味');
  });
});
