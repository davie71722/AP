import { describe, expect, it } from 'vitest';
import { actText, combinedText, hasAdvAirway, keyFlags, patientActs, TQ } from './trauma';
import { injuryText } from '../types';

describe('創傷與處置：整合註解（傷勢 → 評估 → 處置）', () => {
  it('多重傷勢：評估與處置去重、依傷勢與按鈕順序', () => {
    const trauma = [
      { id: 'r-head', name: '重度頭部外傷', acts: ['耳鼻流出血/腦脊髓液', '已抽吸', '已放聲門上呼吸道(i-gel)', '已上頸圈', '頭部抬高30度'] },
      { id: 'r-face', name: '顏面嚴重創傷', acts: ['氣道受阻風險', '口鼻大量出血', '已行環甲膜切開'] },
      { id: 'r-neckpen', name: '頸部穿刺/血腫', acts: ['血腫擴大', '局部加壓止血', '已打大口徑IV'] },
      { id: 'r-ptx', name: '氣胸/血胸', acts: ['呼吸音減弱(左)', '氣管偏移', '已針刺減壓(左)'] },
      { id: 'r-pelvis', name: '不穩定骨盆骨折', acts: ['疑內出血/休克', '已上長背板/鏟式擔架', '已打骨針IO', '已給Transamin', '已輸血'] },
    ];
    expect(
      injuryText({ trauma, wounds: [{ region: '額頭', type: '撕裂傷', cm: 0, deg: '', tbsa: 0, x: 0, y: 0, v: 'face' }] }),
    ).toBe(
      '重度頭部外傷、顏面嚴重創傷、頸部穿刺/血腫、氣胸/血胸、不穩定骨盆骨折；額頭 撕裂傷。' +
        '評估：耳鼻流出血/腦脊髓液、氣道受阻風險、口鼻大量出血、血腫擴大、呼吸音減弱(左)、氣管偏移、疑內出血/休克。' +
        '處置：已抽吸、已放聲門上呼吸道(i-gel)、已上頸圈、頭部抬高30度、已行環甲膜切開、局部加壓止血、已打大口徑IV、已針刺減壓(左)、已上長背板/鏟式擔架、已打骨針IO、已給Transamin、已輸血。',
    );
    expect(keyFlags(trauma)).toEqual(['環甲膜切開', '針刺減壓(左)', '輸血']);
    expect(hasAdvAirway(trauma)).toBe(true);
  });
  it('同一處置在多個傷勢只算一次', () => {
    const t = [
      { id: 'r-head', name: '重度頭部外傷', acts: ['已抽吸'] },
      { id: 'r-face', name: '顏面嚴重創傷', acts: ['已抽吸'] },
    ];
    expect(patientActs(t)).toEqual(['已抽吸']);
    expect(combinedText(t)).toBe('重度頭部外傷、顏面嚴重創傷。處置：已抽吸。');
  });
  it('止血帶自動帶入時間', () => {
    const at = new Date(2026, 10, 21, 14, 25).getTime();
    expect(actText(TQ, at)).toBe('已上止血帶(14:25)');
    expect(keyFlags([{ id: 'r-art', name: '動脈大出血', acts: [actText(TQ, at)] }])).toEqual(['止血帶 14:25']);
  });
  it('綠牌「可搭坐車」接在處置最後', () => {
    expect(combinedText([{ id: 'g-abr', name: '表淺擦傷/挫傷', acts: ['NS清洗傷口', '已貼敷料/紗布', '可搭坐車'] }])).toBe(
      '表淺擦傷/挫傷。處置：NS清洗傷口、已貼敷料/紗布，可搭坐車。',
    );
  });
  it('只點創傷；加上其他註解', () => {
    expect(injuryText({ trauma: [{ id: 'r-pelvis', name: '不穩定骨盆骨折', acts: [] }], note: '酒味' })).toBe('不穩定骨盆骨折。酒味');
  });
});
