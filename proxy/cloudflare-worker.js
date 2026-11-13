// Google Routes API computeRouteMatrix 代理（Cloudflare Worker）
//
// 部署：
//   npx wrangler secret put GOOGLE_MAPS_API_KEY     # 金鑰只存在這裡
//   設定 ALLOWED_ORIGIN 環境變數為前端網址（例如 https://mci.example.gov.tw）
//   npx wrangler deploy proxy/cloudflare-worker.js --name zhuxian-mci-routes
//
// 金鑰建議：以單位／專案帳號申請，只開放 Routes API，並在 Cloud Console 設每日上限與預算警示。

const FIELD_MASK = 'originIndex,destinationIndex,duration,distanceMeters,status,condition';
const MAX_ELEMENTS = 625;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed || origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    if (allowed && origin !== allowed) return new Response('Forbidden', { status: 403, headers: cors });

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad JSON', { status: 400, headers: cors });
    }
    const { origins, destinations } = body || {};
    const valid = (a) =>
      Array.isArray(a) && a.length > 0 && a.every((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
    if (!valid(origins) || !valid(destinations) || origins.length * destinations.length > MAX_ELEMENTS) {
      return new Response('Invalid origins/destinations', { status: 400, headers: cors });
    }
    const wp = (p) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });
    const upstream = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        origins: origins.map(wp),
        destinations: destinations.map(wp),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
