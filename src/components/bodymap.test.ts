import { describe, expect, it } from 'vitest';
import BM from '../data/bodymap.json';
import { woundText, type Wound } from '../types';
import { regionName } from './BodyMap';

const w = (p: Partial<Wound>): Wound => ({ region: '胸部', type: '擦傷', cm: 0, deg: '', tbsa: 0, x: 0, y: 0, v: 'front', ...p });

describe('人形圖（測試清單）', () => {
  it('右眉毛：臉部畫面左側＝病人右側', () => {
    expect(regionName(BM.face.find((r) => r.key === 'fbrowR')!, 'face')).toBe('右眉毛');
  });
  it('手部畫面右下（左手背）中指＋撕裂傷 1.5cm', () => {
    const md = BM.hand.filter((r) => r.key === 'mdL').find((r) => r.y > 200)!;
    const region = regionName(md, 'hand');
    expect(region).toBe('左中指背側');
    expect(woundText(w({ region, type: '撕裂傷', cm: 1.5 }))).toBe('左中指背側 1.5cm 撕裂傷');
    expect(woundText(w({ region, type: '撕裂傷' }))).toBe('左中指背側 撕裂傷');
  });
  it('背面左右相反：畫面左邊上臂＝左上臂後側', () => {
    expect(regionName(BM.body.find((r) => r.key === 'armR')!, 'back')).toBe('左上臂後側');
    expect(regionName(BM.body.find((r) => r.key === 'armR')!, 'front')).toBe('右上臂');
  });
  it('燙傷：不填 → 胸部 燙傷；II 度、5% → 胸部 II度 燙傷 (TBSA 5%)', () => {
    expect(woundText(w({ type: '燙傷' }))).toBe('胸部 燙傷');
    expect(woundText(w({ type: '燙傷', deg: 'II', tbsa: 5 }))).toBe('胸部 II度 燙傷 (TBSA 5%)');
  });
});
