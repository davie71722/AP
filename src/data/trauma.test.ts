import { describe, expect, it } from 'vitest';
import { actText, keyFlags, TQ, type TraumaEntry } from './trauma';
import { injuryPhrase, narrative, procedurePhrase, woundPhrases } from './narrative';
import type { Wound } from '../types';

const W = (region: string, type: string, extra: Partial<Wound> = {}): Wound => ({ region, type, cm: 0, deg: '', tbsa: 0, x: 0, y: 0, v: 'front', ...extra });

describe('交接註解：連接詞敘述', () => {
  it('使用者範例（紅牌）', () => {
    const trauma: TraumaEntry[] = [
      { id: 'r-head', name: '重度頭部外傷', acts: ['耳鼻流出血/腦脊髓液', '已抽吸', '已放i-gel', '已上頸圈', '頭部抬高30度'] },
      { id: 'r-face', name: '顏面嚴重創傷', acts: ['口鼻大量出血', '通報醫導後環甲切'] },
      { id: 'r-neckpen', name: '頸部穿刺/血腫', acts: ['血腫擴大', '氣道受阻風險', '局部加壓止血', '已打大口徑IV'] },
      { id: 'r-ptx', name: '氣胸/血胸', acts: ['呼吸音減弱(左)', '氣管偏移'], sides: ['左'] },
      { id: 'r-pelvis', name: '不穩定骨盆骨折', acts: ['疑內出血/休克', '已上長背板/鏟式擔架', '已打骨針IO', '已給Transamin', '已輸血'] },
    ];
    const wounds = [W('額頭', '撕裂傷'), W('頸部', '挫傷'), W('上唇', '撕裂傷'), W('右前臂', '疑似骨折/脫臼')];
    expect(narrative(trauma, wounds, undefined, 'R')).toBe(
      '重度頭外傷併耳鼻漏、顏面嚴重創傷併口鼻大出血、頸穿刺併血腫擴大及氣道疑似阻塞、左側氣血胸併呼吸音減弱及氣管偏移、不穩定骨盆骨折併疑內出血休克、右前臂疑骨折脫臼；' +
        '處置予抽吸、置i-gel、通報醫導後環甲切、局部加壓止血、長背板頸圈固定並頭抬高30度、建立大口徑IV及IO、給Transamin及輸血。',
    );
  });
  it('三項以上評估用「與」「及」串接；人形圖骨折與四肢傷勢合併', () => {
    expect(injuryPhrase({ id: 'r-neckpen', name: '頸部穿刺/血腫', acts: ['血腫擴大', '皮下氣腫', '氣道受阻風險'] })).toBe('頸穿刺併血腫擴大與皮下氣腫及氣道疑似阻塞');
    expect(narrative([{ id: 'y-fx', name: '單一肢體骨折/脫臼', acts: ['遠端脈搏正常'], sides: ['右上肢'] }], [W('右前臂', '疑似骨折/脫臼', { fx: '閉鎖性' })], undefined, 'Y')).toBe(
      '右前臂閉鎖性骨折併遠端脈搏正常。',
    );
    expect(narrative([{ id: 'r-burn', name: '大面積燒燙傷(>20%)', acts: [] }], [W('胸部', '燙傷', { deg: 'II', tbsa: 18 }), W('右上臂', '燙傷', { deg: 'III', tbsa: 4 }), W('左上臂', '燙傷', { deg: 'III', tbsa: 4 })], undefined, 'R')).toBe(
      '大面積燒燙傷(TBSA合計26%)、胸部II度燙傷、右上臂及左上臂III度燙傷。',
    );
  });
  it('撕裂傷、擦挫傷與人形圖合併成一句；脊椎固定寫「長背板頸圈固定」', () => {
    expect(
      narrative([{ id: 'y-lac', name: '較大撕裂/穿刺(無休克)', acts: ['彈性繃帶加壓止血'] }], [W('右大腿', '撕裂傷', { cm: 6 }), W('額頭', '撕裂傷'), W('右大腿', '挫傷')], undefined, 'Y'),
    ).toBe('右大腿6cm及額頭撕裂穿刺傷、右大腿挫傷；處置予彈性繃帶加壓止血。');
    expect(narrative([{ id: 'g-abr', name: '表淺擦傷/挫傷', acts: [] }], [W('右膝', '擦傷'), W('左前臂', '挫傷')], undefined, 'G')).toBe('右膝及左前臂擦挫傷。');
    expect(procedurePhrase(['已上頸圈及頭部固定', '已上長背板/鏟式擔架', '全身脊椎固定完成', '已上牽引固定器', '頭部抬高30度'])).toBe('長背板頸圈及牽引器固定並頭抬高30度');
    expect(procedurePhrase(['已上長背板/真空墊'])).toBe('長背板固定');
  });
  it('黃綠牌保留輕微傷，相同傷勢合併部位', () => {
    expect(woundPhrases([W('額頭', '撕裂傷'), W('上唇', '撕裂傷'), W('頸部', '挫傷')], 'Y')).toEqual(['額頭及上唇撕裂傷', '頸部挫傷']);
    expect(woundPhrases([W('左大腿', '撕裂傷', { cm: 3 }), W('胸部', '燙傷', { deg: 'II', tbsa: 5 })], 'G')).toEqual(['左大腿3cm撕裂傷', '胸部II度燙傷(TBSA 5%)']);
    expect(woundPhrases([W('額頭', '撕裂傷'), W('胸部', '擦傷')], 'R')).toEqual([]);
  });
  it('股骨骨折可單側並分開放性／閉鎖性', () => {
    expect(injuryPhrase({ id: 'r-femur', name: '股骨骨折', acts: [], sides: ['右'], subtype: '開放性' })).toBe('右側開放性股骨骨折');
    expect(injuryPhrase({ id: 'r-femur', name: '股骨骨折', acts: ['遠端脈搏消失'], sides: ['右', '左'], subtype: '閉鎖性' })).toBe('雙側閉鎖性股骨骨折併遠端脈搏消失');
  });
  it('四肢側別、止血帶時間', () => {
    const at = new Date(2026, 10, 21, 14, 25).getTime();
    const t: TraumaEntry = { id: 'r-art', name: '動脈大出血', acts: [actText(TQ, at), '已填塞止血紗布'], sides: ['左下肢'] };
    expect(narrative([t])).toBe('左下肢動脈大出血；處置予左下肢止血帶(14:25)、止血紗布填塞。');
    expect(keyFlags([t])).toEqual(['止血帶 左下肢 14:25']);
  });
  it('綠牌可搭坐車；只有傷勢；其他註解', () => {
    expect(narrative([{ id: 'g-abr', name: '表淺擦傷/挫傷', acts: ['NS清洗傷口', '已貼敷料/紗布', '可搭坐車'] }])).toBe('表淺擦挫傷；處置予NS清洗傷口、貼敷料/紗布，可搭坐車。');
    expect(narrative([{ id: 'r-pelvis', name: '不穩定骨盆骨折', acts: [] }], [], '酒味')).toBe('不穩定骨盆骨折。酒味');
  });
  it('處置分組：給藥與輸血、固定合併', () => {
    expect(procedurePhrase(['已輸血'])).toBe('輸血');
    expect(procedurePhrase(['已上頸圈及頭部固定', '已上骨盆固定帶', '已給Nalbuphine'])).toBe('頸圈及骨盆帶固定、給Nalbuphine');
  });
});
