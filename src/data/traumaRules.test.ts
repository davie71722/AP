import { describe, expect, it } from 'vitest';
import { combinedText, entryName, keepForColor, limbOf, regionGroups, traumaForRegion, type TraumaEntry } from './trauma';
import { actState, addAct, removeAct, sideLock, toggleSide, traumaWarnings } from './traumaRules';
import type { Wound } from '../types';

const T = (id: string, name: string, acts: string[] = [], sides?: string[]): TraumaEntry => ({ id, name, acts, ...(sides ? { sides } : {}) });
const now = new Date(2026, 10, 21, 14, 25).getTime();
const acts = (l: TraumaEntry[]) => [...new Set(l.flatMap((t) => t.acts))];

describe('防呆：氧氣與呼吸道', () => {
  const base = [T('r-head', '重度頭部外傷'), T('r-face', '顏面嚴重創傷')];
  it('給氧裝置一次一種', () => {
    let l = addAct(base, 'r-head', 'NRM給氧', now);
    l = addAct(l, 'r-head', 'BVM給氧', now);
    expect(acts(l)).toEqual(['BVM給氧']);
  });
  it('建立進階呼吸道：移除 NRM、口咽呼吸道，自動加 BVM；NRM 停用', () => {
    let l = addAct(base, 'r-head', 'NRM給氧', now);
    l = addAct(l, 'r-face', '已放口咽/鼻咽呼吸道', now);
    l = addAct(l, 'r-head', '已放聲門上呼吸道(i-gel)', now);
    expect(acts(l).sort()).toEqual(['BVM給氧', '已放聲門上呼吸道(i-gel)'].sort());
    expect(actState(l, 'NRM給氧').disabled).toBe(true);
    expect(actState(l, '已放口咽/鼻咽呼吸道').disabled).toBe(true);
    expect(actState(l, 'BVM給氧').stored).toBe('BVM給氧');
    // 停用的按鈕點了不會加入
    expect(addAct(l, 'r-head', 'NRM給氧', now)).toBe(l);
  });
  it('進階呼吸道一次一種：i-gel 換成環甲膜切開', () => {
    let l = addAct(base, 'r-head', '已放聲門上呼吸道(i-gel)', now);
    l = addAct(l, 'r-face', '已行環甲膜切開', now);
    expect(acts(l).sort()).toEqual(['BVM給氧', '已行環甲膜切開'].sort());
  });
  it('BVM 不重複', () => {
    let l = addAct(base, 'r-head', 'BVM給氧', now);
    l = addAct(l, 'r-face', '已插氣管內管', now);
    expect(l.flatMap((t) => t.acts).filter((a) => a === 'BVM給氧')).toHaveLength(1);
  });
  it('取消 BVM 後提醒', () => {
    let l = addAct(base, 'r-head', '已插氣管內管', now);
    l = removeAct(l, 'BVM給氧');
    expect(traumaWarnings(l).join()).toContain('未記錄 BVM 給氧');
  });
  it('GCS≤8 未建立進階呼吸道提醒；血氧<90% 未給氧提醒', () => {
    const w = traumaWarnings([T('r-head', '重度頭部外傷', ['GCS≤8']), T('r-inhal', '吸入性灼傷', ['血氧<90%'])]).join();
    expect(w).toContain('尚未建立進階呼吸道');
    expect(w).toContain('尚未記錄給氧');
  });
});

describe('防呆：管路、頸圈、藥物', () => {
  it('大口徑／雙線 IV 取代已打IV', () => {
    let l = [T('r-amp', '創傷性截肢/壓砸', [], ['右下肢'])];
    l = addAct(l, 'r-amp', '已打IV', now);
    l = addAct(l, 'r-amp', '已打雙線IV', now);
    expect(acts(l)).toEqual(['已打雙線IV']);
    expect(actState(l, '已打IV').disabled).toBe(true);
  });
  it('頸圈及頭部固定取代已上頸圈', () => {
    let l = [T('r-head', '重度頭部外傷'), T('r-cspine', '疑頸椎損傷')];
    l = addAct(l, 'r-head', '已上頸圈', now);
    l = addAct(l, 'r-cspine', '已上頸圈及頭部固定', now);
    expect(acts(l)).toEqual(['已上頸圈及頭部固定']);
  });
  it('休克時給 Nalbuphine、休克未建管路、輸血無管路：提醒', () => {
    const w = traumaWarnings([T('r-pelvis', '不穩定骨盆骨折', ['疑內出血/休克', '已給Nalbuphine', '已輸血'])]).join();
    expect(w).toContain('Nalbuphine');
    expect(w).toContain('尚未建立 IV／IO');
    expect(w).toContain('已輸血，但未記錄');
  });
});

describe('防呆：左右側', () => {
  it('四肢傷勢未選側別提醒；名稱帶側別', () => {
    expect(traumaWarnings([T('r-art', '動脈大出血')]).join()).toContain('尚未選肢體側別');
    expect(entryName(T('r-art', '動脈大出血', [], ['左下肢', '右上肢']))).toBe('動脈大出血(右上肢、左下肢)');
    expect(entryName(T('r-ptx', '氣胸/血胸', [], ['左', '右']))).toBe('氣胸/血胸(雙側)');
  });
  it('胸部：點針刺減壓(左)自動補左側；右側減壓停用', () => {
    let l = [T('r-ptx', '氣胸/血胸')];
    l = addAct(l, 'r-ptx', '已針刺減壓(左)', now);
    expect(l[0].sides).toEqual(['左']);
    expect(actState(l, '已針刺減壓(右)').disabled).toBe(true);
    expect(actState(l, '呼吸音減弱(右)').disabled).toBe(true);
    // 有左側減壓時不能取消左側
    expect(sideLock(l, 'r-ptx', '左')).toContain('針刺減壓(左)');
    expect(toggleSide(l, 'r-ptx', '左')).toBe(l);
    // 加右側後右側可用（雙側）
    l = toggleSide(l, 'r-ptx', '右');
    expect(actState(l, '已針刺減壓(右)').disabled).toBe(false);
    expect(combinedText(l)).toBe('氣胸/血胸(雙側)。處置：已針刺減壓(左)。');
  });
  it('胸部改側時移除矛盾的呼吸音記錄', () => {
    let l = [T('r-ptx', '氣胸/血胸', ['呼吸音減弱(右)'])];
    l = toggleSide(l, 'r-ptx', '左');
    expect(acts(l)).toEqual([]);
  });
  it('人形圖肢體側別與傷勢不同：提醒', () => {
    const wounds: Wound[] = [{ region: '左小腿', type: '撕裂傷', cm: 0, deg: '', tbsa: 0, x: 0, y: 0, v: 'front' }];
    expect(traumaWarnings([T('r-art', '動脈大出血', [], ['右下肢'])], wounds).join()).toContain('側別（左小腿）不同');
    expect(traumaWarnings([T('r-art', '動脈大出血', [], ['左下肢'])], wounds)).toEqual([]);
  });
  it('部位名稱 → 肢體側別', () => {
    expect(limbOf('右前臂')).toBe('右上肢');
    expect(limbOf('左中指背側')).toBe('左上肢');
    expect(limbOf('左大拇趾')).toBe('左下肢');
    expect(limbOf('右膝窩')).toBe('右下肢');
    expect(limbOf('胸部')).toBeNull();
  });
  it('止血帶沒有出血／截肢傷勢：提醒', () => {
    expect(traumaWarnings([T('r-femur', '雙側股骨骨折', ['已上止血帶(14:25)'])]).join()).toContain('已上止血帶，但未記錄');
  });
});

describe('牌色與人形圖', () => {
  it('黃綠不需要紅牌傷勢：降級移除較高等級', () => {
    const l = [T('r-head', '重度頭部外傷'), T('y-fx', '單一肢體骨折/脫臼', [], ['右上肢']), T('g-abr', '表淺擦傷/挫傷')];
    expect(keepForColor(l, 'Y').map((t) => t.id)).toEqual(['y-fx', 'g-abr']);
    expect(keepForColor(l, 'G').map((t) => t.id)).toEqual(['g-abr']);
    expect(keepForColor(l, 'R')).toHaveLength(3);
  });
  it('人形圖部位 → 對應傷勢', () => {
    const ids = (c: 'R' | 'Y' | 'G', key: string, view: string) => traumaForRegion(c, regionGroups(key, view)).map((d) => d.id);
    expect(ids('R', 'chest', 'front')).toEqual(['r-ptx', 'r-flail', 'r-burn', 'r-shock']);
    expect(ids('R', 'thL', 'front')).toEqual(['r-art', 'r-amp', 'r-femur', 'r-burn', 'r-shock']);
    expect(ids('R', 'faR', 'front')).not.toContain('r-femur');
    expect(ids('Y', 'faR', 'front')).toEqual(['y-fx', 'y-openfx', 'y-burn', 'y-lac']);
    expect(ids('Y', 'chest', 'back')).toContain('y-spine');
    expect(ids('G', 'lgR', 'front')).toEqual(['g-abr', 'g-lac', 'g-sprain', 'g-burn']);
  });
  it('燙傷 TBSA 與燒傷分類不符：提醒', () => {
    const wounds: Wound[] = [{ region: '胸部', type: '燙傷', cm: 0, deg: 'II', tbsa: 25, x: 0, y: 0, v: 'front' }];
    expect(traumaWarnings([T('y-burn', '中度燒燙傷(10-20%)')], wounds).join()).toContain('不符');
    expect(traumaWarnings([], wounds).join()).toContain('請考慮紅牌');
  });
});
