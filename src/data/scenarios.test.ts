import { expect, it } from 'vitest';
import { keepForColor, keyFlags, TRAUMA_BY_ID, TQ, type TraumaEntry } from './trauma';
import { actState, addAct, setSubtype, toggleSide, traumaWarnings } from './traumaRules';
import { narrative } from './narrative';
import type { Color, Wound } from '../types';

let t0 = new Date(2026, 10, 21, 14, 20).getTime();
const W = (region: string, type: string, extra: Partial<Wound> = {}): Wound => ({ region, type, cm: 0, deg: '', tbsa: 0, x: 0, y: 0, v: 'front', ...extra });
class P {
  l: TraumaEntry[] = [];
  w: Wound[] = [];
  log: string[] = [];
  constructor(public c: Color) {}
  tr(id: string, sides?: string[], sub?: string) {
    this.l = [...this.l, { id, name: TRAUMA_BY_ID[id].name, acts: [] }];
    for (const s of sides ?? []) this.l = toggleSide(this.l, id, s);
    if (sub) this.l = setSubtype(this.l, id, sub);
    return this;
  }
  a(id: string, ...acts: string[]) {
    for (const x of acts) {
      const st = actState(this.l, x);
      if (st.disabled) this.log.push(`✋${x}：${st.reason}`);
      else if (st.stored) this.log.push(`↺${x} 已選`);
      this.l = addAct(this.l, id, x, (t0 += 60000));
    }
    return this;
  }
  show(title: string) {
    expect(`【${title}】(${this.c})\n ${narrative(this.l, this.w, undefined, this.c)}\n 醒目：${keyFlags(this.l).join(' ') || '—'}\n 提醒：${traumaWarnings(this.l, this.w).join('｜') || '—'}\n 擋下：${this.log.join('｜') || '—'}`).toMatchSnapshot(title);
  }
}

// 紅、黃各五個複雜病人：模擬點選順序，檢查交接註解、醒目標示、提醒與被擋下的操作
it('紅黃複雜病人情境', () => {
  // R1 高速車禍
  const r1 = new P('R').tr('r-head').a('r-head', '意識不清', 'GCS≤8', '瞳孔不等大', '已抽吸', 'NRM給氧', '已插氣管內管', 'BVM給氧', '已放i-gel', '頸圈固定');
  r1.tr('r-ptx', ['左']).a('r-ptx', '呼吸音減弱(左)', '已針刺減壓(左)', '已針刺減壓(右)', 'NRM給氧');
  r1.tr('r-pelvis').a('r-pelvis', '疑內出血/休克', '骨盆固定帶固定', '已打雙線IV', '已給Transamin', '已輸血');
  r1.w = [W('額頭', '撕裂傷'), W('右前臂', '疑似骨折/脫臼', { fx: '開放性' }), W('胸部', '擦傷')];
  r1.show('R1 高速車禍：頭＋左氣胸＋骨盆');
  // R2 爆炸：右下肢截肢＋左上肢動脈出血
  const r2 = new P('R').tr('r-amp', ['右下肢']).a('r-amp', '出血性休克', TQ, '斷肢低溫保存隨行', '已給Nalbuphine', '已打雙線IV');
  r2.tr('r-crush', ['左下肢']).a('r-crush', '壓砸症候群風險', '遠端脈搏消失', '副木固定', '已給NS輸液');
  r2.tr('r-art', ['左上肢']).a('r-art', TQ, '已填塞止血紗布', '已給Transamin', '已輸血');
  r2.w = [W('左前臂', '撕裂傷', { cm: 8 }), W('右小腿', '截肢')];
  r2.show('R2 爆炸：右下肢截肢＋左下肢壓砸＋左上肢大出血');
  // R3 火災
  const r3 = new P('R').tr('r-burn').a('r-burn', '吸入性灼傷疑慮', '環狀燒傷', '無菌乾紗/燒傷敷料覆蓋', '已保溫防失溫', '已打IV/IO輸液', 'NRM給氧');
  r3.tr('r-inhal').a('r-inhal', '聲音沙啞/喘鳴', '口鼻焦黑/鼻毛燒焦', '血氧<90%', '預防性插管完成', 'NRM給氧', 'BVM給氧');
  r3.w = [W('胸部', '燙傷', { deg: 'II', tbsa: 18 }), W('右上臂', '燙傷', { deg: 'III', tbsa: 4 }), W('左上臂', '燙傷', { deg: 'III', tbsa: 4 })];
  r3.show('R3 火災：大面積燒傷＋吸入性灼傷');
  // R4 刺傷
  const r4 = new P('R').tr('r-neckpen').a('r-neckpen', '血腫擴大', '皮下氣腫', '氣道受阻風險', '局部加壓止血', '通報醫導後環甲切', 'NRM給氧', '已打大口徑IV');
  r4.tr('r-flail', ['右']).a('r-flail', '呼吸窘迫', '血氧<90%', '已貼胸部封閉敷料', '異物固定未拔除');
  r4.tr('r-evisc').a('r-evisc', '疑內出血/休克', '臟器NS濕紗覆蓋', '已打骨針IO', '已保溫防失溫');
  r4.show('R4 多處刺傷：頸＋右胸＋腹');
  // R5 墜落
  const r5 = new P('R').tr('r-cspine').a('r-cspine', '四肢癱瘓/無力', '神經性休克(低血壓/心跳慢)', '頸圈固定', '長背板固定');
  r5.tr('r-head').a('r-head', '意識改變', '頸圈固定', '頭部抬高30度');
  r5.tr('r-femur', ['右', '左'], '閉鎖性').a('r-femur', '遠端脈搏消失', '副木固定', '已給Nalbuphine');
  r5.tr('r-shock').a('r-shock', '血壓<90', '心跳>120', '長背板固定', '已打骨針IO');
  r5.show('R5 高處墜落：頸椎＋雙股骨＋休克');

  // Y1
  const y1 = new P('Y').tr('y-fx', ['右上肢']).a('y-fx', '副木固定', '三角巾固定', '遠端脈搏正常', '已給Nalbuphine');
  y1.tr('y-head').a('y-head', '傷口加壓包紮', '曾短暫昏迷', '生命徵象穩定');
  y1.w = [W('右前臂', '疑似骨折/脫臼', { fx: '閉鎖性' }), W('額頭', '撕裂傷'), W('右眉毛', '撕裂傷', { cm: 2 })];
  y1.show('Y1 機車：右前臂骨折＋頭撞擊');
  // Y2
  const y2 = new P('Y').tr('y-openfx', ['左下肢']).a('y-openfx', '無菌敷料覆蓋', '副木固定', '遠端脈搏正常', '已打IV');
  y2.tr('y-lac').a('y-lac', '彈性繃帶加壓止血', '無菌敷料包紮', '已打IV');
  y2.w = [W('左小腿', '疑似骨折/脫臼', { fx: '開放性' }), W('右大腿', '撕裂傷', { cm: 6 }), W('右大腿', '挫傷')];
  y2.show('Y2 開放性骨折＋撕裂傷');
  // Y3
  const y3 = new P('Y').tr('y-burn').a('y-burn', '已沖水降溫', '無菌敷料覆蓋', 'Mask給氧', 'NRM給氧');
  y3.w = [W('右前臂', '燙傷', { deg: 'II', tbsa: 8 }), W('左前臂', '燙傷', { deg: 'II', tbsa: 6 })];
  y3.show('Y3 中度燒燙傷');
  // Y4
  const y4 = new P('Y').tr('y-spine').a('y-spine', '頸圈固定', '長背板固定', '四肢肌力正常');
  y4.tr('y-head').a('y-head', '傷口加壓包紮', '生命徵象穩定');
  y4.w = [W('後頭部', '撕裂傷', { v: 'back' }), W('腰背部', '挫傷', { v: 'back' })];
  y4.show('Y4 背頸痛＋頭撞擊');
  // Y5 升紅再降黃
  const y5 = new P('Y').tr('y-fx', ['左下肢']).a('y-fx', '副木固定');
  y5.c = 'R';
  y5.tr('r-art', ['左下肢']).a('r-art', TQ, '已打雙線IV');
  y5.show('Y5a 黃升紅（保留黃牌骨折）');
  y5.c = 'Y';
  y5.l = keepForColor(y5.l, 'Y');
  y5.show('Y5b 再降回黃（紅牌移除）');
});
