import { describe, expect, it } from 'vitest';
import { TRAUMA_BY_ID, entryName, keepForColor, limbOf, regionGroups, traumaForRegion, type TraumaEntry } from './trauma';
import { actState, addAct, ownerOf, setSubtype, sideLock, toggleSide, traumaWarnings } from './traumaRules';
import type { Wound } from '../types';
import { narrative } from './narrative';

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
  it('建立進階呼吸道：移除並停用所有給氧（含 BVM）與口咽呼吸道', () => {
    let l = addAct(base, 'r-head', 'BVM給氧', now);
    l = addAct(l, 'r-face', '已放口咽/鼻咽呼吸道', now);
    l = addAct(l, 'r-head', '已放i-gel', now);
    expect(acts(l)).toEqual(['已放i-gel']);
    for (const o of ['NRM給氧', 'Mask給氧', 'BVM給氧']) expect(actState(l, o).disabled).toBe(true);
    expect(actState(l, '已放口咽/鼻咽呼吸道').disabled).toBe(true);
    // 停用的按鈕點了不會加入
    expect(addAct(l, 'r-head', 'NRM給氧', now)).toBe(l);
  });
  it('進階呼吸道一次一種：i-gel 換成環甲膜切開', () => {
    let l = addAct(base, 'r-head', '已放i-gel', now);
    l = addAct(l, 'r-face', '通報醫導後環甲切', now);
    expect(acts(l)).toEqual(['通報醫導後環甲切']);
  });
  it('處置只能在第一次點選的傷勢下取消', () => {
    const l = addAct(base, 'r-head', '已抽吸', now);
    expect(ownerOf(l, '已抽吸')?.id).toBe('r-head');
  });
  it('GCS≤8 未建立進階呼吸道提醒；血氧<90% 未給氧提醒', () => {
    const w = traumaWarnings([T('r-head', '重度頭部外傷', ['GCS≤8']), T('r-inhal', '吸入性灼傷', ['血氧<90%'])]).join();
    expect(w).toContain('尚未建立進階呼吸道');
    expect(w).toContain('尚未記錄給氧');
  });
});

describe('防呆：管路、頸圈、藥物', () => {
  it('大口徑／雙線 IV 取代已打IV', () => {
    let l = [T('r-amp', '創傷性截肢', [], ['右下肢'])];
    l = addAct(l, 'r-amp', '已打IV', now);
    l = addAct(l, 'r-amp', '已打雙線IV', now);
    expect(acts(l)).toEqual(['已打雙線IV']);
    expect(actState(l, '已打IV').disabled).toBe(true);
  });
  it('已插管就不能放 i-gel', () => {
    let l = [T('r-head', '重度頭部外傷'), T('r-face', '顏面嚴重創傷')];
    l = addAct(l, 'r-head', '已插氣管內管', now);
    expect(actState(l, '已放i-gel').disabled).toBe(true);
    expect(addAct(l, 'r-face', '已放i-gel', now)).toBe(l);
  });
  it('固定選項統一：頸圈、長背板、骨盆固定帶、三角巾、副木、KED', () => {
    expect(TRAUMA_BY_ID['r-cspine'].acts).toEqual(expect.arrayContaining(['頸圈固定', '長背板固定', 'KED固定']));
    expect(TRAUMA_BY_ID['y-fx'].acts).toEqual(expect.arrayContaining(['副木固定', '三角巾固定']));
    expect(TRAUMA_BY_ID['r-pelvis'].acts).toContain('骨盆固定帶固定');
    const all = Object.values(TRAUMA_BY_ID).flatMap((d) => d.acts).filter((a) => /固定/.test(a) && !/異物固定/.test(a));
    expect([...new Set(all)].sort()).toEqual(['KED固定', '三角巾固定', '副木固定', '長背板固定', '頸圈固定', '骨盆固定帶固定'].sort());
  });
  it('休克時給 Nalbuphine、休克未建管路：提醒；輸血視為已有管路', () => {
    const w = traumaWarnings([T('r-pelvis', '不穩定骨盆骨折', ['疑內出血/休克', '已給Nalbuphine'])]).join();
    expect(w).toContain('Nalbuphine');
    expect(w).toContain('尚未建立 IV／IO');
    // 輸血即有管路，不提醒
    expect(traumaWarnings([T('r-pelvis', '不穩定骨盆骨折', ['疑內出血/休克', '已輸血'])])).toEqual([]);
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
    expect(narrative(l)).toBe('雙側氣血胸；處置予左側針刺減壓。');
  });
  it('胸部改側時移除矛盾的呼吸音記錄', () => {
    let l = [T('r-ptx', '氣胸/血胸', ['呼吸音減弱(右)'])];
    l = toggleSide(l, 'r-ptx', '左');
    expect(acts(l)).toEqual([]);
  });
  it('人形圖側別與同類傷勢不同才提醒（不同肢體的不同傷勢不誤報）', () => {
    const fx: Wound[] = [{ region: '左前臂', type: '疑似骨折/脫臼', cm: 0, deg: '', tbsa: 0, x: 0, y: 0, v: 'front' }];
    expect(traumaWarnings([T('y-fx', '單一肢體骨折/脫臼', [], ['右上肢'])], fx).join()).toContain('骨折部位（左前臂）側別不同');
    expect(traumaWarnings([T('y-fx', '單一肢體骨折/脫臼', [], ['左上肢'])], fx)).toEqual([]);
    const amp: Wound[] = [{ region: '右小腿', type: '截肢', cm: 0, deg: '', tbsa: 0, x: 0, y: 0, v: 'front' }];
    expect(traumaWarnings([T('r-amp', '創傷性截肢', [], ['右下肢']), T('r-art', '動脈大出血', [], ['左上肢'])], amp)).toEqual([]);
  });
  it('部位名稱 → 肢體側別', () => {
    expect(limbOf('右前臂')).toBe('右上肢');
    expect(limbOf('左中指背側')).toBe('左上肢');
    expect(limbOf('左大拇趾')).toBe('左下肢');
    expect(limbOf('右膝窩')).toBe('右下肢');
    expect(limbOf('胸部')).toBeNull();
  });
  it('兩個肢體各自上止血帶（不共用），註解標示肢體', () => {
    let l = [T('r-amp', '創傷性截肢', [], ['右下肢']), T('r-art', '動脈大出血', [], ['左上肢'])];
    l = addAct(l, 'r-amp', '已上止血帶(自動帶入時間)', now);
    l = addAct(l, 'r-art', '已上止血帶(自動帶入時間)', now + 120000);
    expect(l.map((t) => t.acts.length)).toEqual([1, 1]);
    expect(narrative(l)).toBe('右下肢創傷性截肢、左上肢動脈大出血；處置予右下肢止血帶(14:25)、左上肢止血帶(14:27)。');
  });
  it('止血帶沒有出血／截肢傷勢：提醒', () => {
    expect(traumaWarnings([T('r-pelvis', '不穩定骨盆骨折', ['已上止血帶(14:25)'])]).join()).toContain('已上止血帶，但未記錄');
  });
  it('股骨骨折：未選側別、型態提醒', () => {
    let l = [T('r-femur', '股骨骨折')];
    const w = traumaWarnings(l).join();
    expect(w).toContain('尚未選左右側');
    expect(w).toContain('閉鎖性／開放性');
    l = setSubtype(toggleSide(l, 'r-femur', '右'), 'r-femur', '開放性');
    expect(traumaWarnings(l)).toEqual([]);
    expect(entryName(l[0])).toBe('股骨骨折(右、開放性)');
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
    expect(ids('R', 'thL', 'front')).toEqual(['r-art', 'r-amp', 'r-crush', 'r-femur', 'r-burn', 'r-shock']);
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
