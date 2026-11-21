import { describe, expect, it } from 'vitest';
import { mapsShortLink, parseCoords, pinLocation, shareName } from './geo';

describe('地點輸入解析', () => {
  it('座標', () => {
    expect(parseCoords('24.8305, 121.0123')).toEqual({ lat: 24.8305, lng: 121.0123 });
    expect(parseCoords('24.8305，121.0123')).toEqual({ lat: 24.8305, lng: 121.0123 });
    expect(parseCoords('121.0123, 24.8305')).toEqual({ lat: 24.8305, lng: 121.0123 });
  });
  it('Google 地圖連結', () => {
    expect(parseCoords('https://www.google.com/maps/@24.7905,121.039,17z')).toEqual({ lat: 24.7905, lng: 121.039 });
    expect(parseCoords('https://maps.google.com/?q=24.75,120.98')).toEqual({ lat: 24.75, lng: 120.98 });
    expect(
      parseCoords('https://www.google.com/maps/place/X/@24.80,120.99,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d24.8011!4d120.9921'),
    ).toEqual({ lat: 24.8011, lng: 120.9921 });
    expect(mapsShortLink('https://maps.app.goo.gl/abc123')).toBe('https://maps.app.goo.gl/abc123');
  });
  it('度分秒（Google 地圖點選處顯示的格式）', () => {
    const c = parseCoords(`24°49'48.0"N 121°00'43.2"E`)!;
    expect(c.lat).toBeCloseTo(24.83, 4);
    expect(c.lng).toBeCloseTo(121.012, 4);
  });
  it('Google 地圖「分享」文字：地點名稱＋網址', () => {
    const t = '東元綜合醫院\nhttps://maps.app.goo.gl/AbC123xyz';
    expect(mapsShortLink(t)).toBe('https://maps.app.goo.gl/AbC123xyz');
    expect(shareName(t)).toBe('東元綜合醫院');
    expect(parseCoords(t)).toBeNull();
    const pin = '已放置的圖釘\nhttps://maps.google.com/?q=24.876200,121.012500';
    expect(parseCoords(pin)).toEqual({ lat: 24.8762, lng: 121.0125 });
  });
  it('地址文字不誤判為座標', () => {
    expect(parseCoords('新竹縣竹東鎮中興路四段99號')).toBeNull();
  });
  it('依座標判斷轄區分隊', () => {
    expect(pinLocation(24.793, 121.037)).toMatchObject({ unit: '二重', area: '二重', township: '竹東' });
    expect(pinLocation(24.76, 120.985)).toMatchObject({ unit: '寶山', area: '寶山' });
    expect(pinLocation(24.876, 121.012)).toMatchObject({ unit: '山崎', area: '山崎', township: '新豐' });
    expect(pinLocation(24.84, 121.012)).toMatchObject({ unit: '竹北', area: '竹北' });
    expect(pinLocation(24.62, 121.28)).toMatchObject({ unit: '田埔', area: '尖石' });
  });
});
