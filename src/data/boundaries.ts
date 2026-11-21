// 新竹縣鄉鎮界線（taiwan-atlas，MIT；源自內政部鄉鎮市區界線開放資料），離線判斷事故現場所在鄉鎮
import data from './hsinchu-towns.json';

type Ring = number[][]; // [lng, lat][]
interface Town {
  name: string;
  polygons: Ring[][];
}

export const TOWN_SHAPES: Town[] = data.towns as Town[];
/** 有例外轄區的村里界線 */
export const VILLAGE_SHAPES: (Town & { township: string })[] = (data.villages ?? []) as (Town & { township: string })[];
export const HSINCHU_CITY_SHAPE: Ring[][] = data.hsinchuCity as Ring[][];
export const BOUNDARY_SOURCE: string = data.source;

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lng: number, lat: number, poly: Ring[]): boolean {
  if (!inRing(lng, lat, poly[0])) return false;
  for (let k = 1; k < poly.length; k++) if (inRing(lng, lat, poly[k])) return false; // 內環（洞）
  return true;
}

/** 座標所在的新竹縣鄉鎮（不在縣內回傳 null） */
export function townshipAt(lat: number, lng: number): string | null {
  for (const t of TOWN_SHAPES) if (t.polygons.some((p) => inPolygon(lng, lat, p))) return t.name;
  return null;
}

/** 座標所在的村里（僅限有例外轄區、已收錄界線的村里） */
export function villageAt(lat: number, lng: number): { township: string; name: string } | null {
  for (const v of VILLAGE_SHAPES) if (v.polygons.some((p) => inPolygon(lng, lat, p))) return { township: v.township, name: v.name };
  return null;
}
