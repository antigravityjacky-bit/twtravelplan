/**
 * GET /api/resolve-maps?url=<google_maps_url>
 *
 * Resolves any Google Maps URL — including maps.app.goo.gl Firebase Dynamic Links —
 * and extracts lat/lng coordinates.
 *
 * maps.app.goo.gl links are Firebase Dynamic Links. They may:
 *  (a) Return an HTTP 301/302 redirect directly to the Google Maps page, OR
 *  (b) Return a 200 HTML page that embeds the destination in JS / meta tags
 *      (this happens when Firebase can't determine the client device type)
 *
 * The HTML embed contains coordinates in several places:
 *  - <meta property="al:ios:url" content="comgooglemaps://?center=lat,lng&q=...">
 *  - <meta property="al:android:url" content="google.navigation:q=lat,lng">
 *  - JS variables: continueUrl / deepLinkUrl / fallbackUrl
 *  - Embedded google.com/maps URLs with @lat,lng in the path
 */

const UAS = [
  // Googlebot — often gets a clean 301 to the Maps page
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  // Desktop Chrome
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // curl — minimal UA, sometimes triggers simpler redirect
  'curl/7.88.1',
  // Mobile Safari
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  for (const ua of UAS) {
    const result = await tryResolve(url, ua);
    if (result?.lat != null) return res.json(result);
  }

  return res.json({ error: 'Could not extract coordinates from this link' });
}

// ─── Main resolution pipeline ─────────────────────────────────────────────

async function tryResolve(startUrl, ua) {
  // Strategy A: manually follow redirects hop-by-hop (up to 6 hops)
  const fromRedirects = await followRedirects(startUrl, ua);
  if (fromRedirects?.lat != null) return fromRedirects;

  // Strategy B: let fetch follow all redirects, then scan response URL + HTML
  return fetchAndScan(startUrl, ua);
}

async function followRedirects(startUrl, ua, maxHops = 6) {
  let current = startUrl;
  const visited = new Set();

  for (let hop = 0; hop < maxHops; hop++) {
    if (visited.has(current)) break;
    visited.add(current);

    // Check if the current URL itself contains coordinates
    const urlCoords = extractCoordsFromUrl(current);
    if (urlCoords) return urlCoords;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const r = await fetch(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': ua },
      });
      clearTimeout(timer);

      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location');
        if (!loc) break;
        current = absoluteUrl(loc, current);
        continue; // next hop
      }

      if (r.status === 200) {
        // Final destination — scan the HTML
        const html = await r.text();
        return extractCoordsFromHtml(html, current);
      }

      break;
    } catch {
      break;
    }
  }
  return null;
}

async function fetchAndScan(url, ua) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);

    const r = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': ua },
    });

    // Check the resolved URL first
    const urlCoords = extractCoordsFromUrl(r.url);
    if (urlCoords) return urlCoords;

    const html = await r.text();
    return extractCoordsFromHtml(html, r.url);
  } catch {
    return null;
  }
}

// ─── Coordinate extraction from URLs ─────────────────────────────────────

function extractCoordsFromUrl(raw) {
  if (!raw) return null;
  const url = safeDecodeURIComponent(raw);

  // @lat,lng[,zoom] — standard Google Maps format
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return coords(at[1], at[2], raw);

  // ?q=lat,lng or &q=lat,lng
  const q = url.match(/[?&]q=(-?\d+\.\d+)[,+](-?\d+\.\d+)/);
  if (q) return coords(q[1], q[2], raw);

  // ?ll=lat,lng
  const ll = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (ll) return coords(ll[1], ll[2], raw);

  // ?center=lat,lng (used in some sharing formats)
  const center = url.match(/[?&]center=(-?\d+\.\d+)[,%20]+(-?\d+\.\d+)/);
  if (center) return coords(center[1], center[2], raw);

  return null;
}

// ─── Coordinate extraction from HTML ─────────────────────────────────────

function extractCoordsFromHtml(html, baseUrl) {
  // 1. ── comgooglemaps:// deep links ──────────────────────────────────────
  //    Firebase Dynamic Link HTML contains these in <meta property="al:ios:url">
  //    and in JavaScript. They reliably have the place coordinates.
  //
  //    Example:
  //      <meta property="al:ios:url"
  //            content="comgooglemaps://?center=25.0478%2C121.5319&q=PlaceName">
  //
  const cgmPattern = /comgooglemaps:\/\/[^\s"'<>\\]*/g;
  for (const raw of (html.match(cgmPattern) || [])) {
    const link = safeDecodeURIComponent(raw.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&'));
    const c = extractCGMCoords(link);
    if (c) return { ...c, resolvedUrl: baseUrl };
  }

  // 2. ── android-app / google.navigation deep links ───────────────────────
  //    <meta property="al:android:url" content="google.navigation:q=lat,lng">
  const navMatch = html.match(/google\.navigation:q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (navMatch) return coords(navMatch[1], navMatch[2], baseUrl);

  // 3. ── All google.com/maps URLs embedded in the HTML ────────────────────
  const mapsUrlRe = /https?:\/\/(?:www\.)?(?:maps\.google\.com|google\.com\/maps)[^\s"'<>\\]*/g;
  for (const raw of (html.match(mapsUrlRe) || [])) {
    const c = extractCoordsFromUrl(safeDecodeURIComponent(raw));
    if (c) return c;
  }

  // 4. ── Firebase Dynamic Link JS variables ──────────────────────────────
  //    continueUrl / deepLinkUrl / fallbackUrl / redirectUrl
  const fbVarRe = /(?:continueUrl|deepLinkUrl|redirectUrl|fallbackUrl|link)\s*[=:]\s*["'`]([^"'`]{10,})["'`]/gi;
  for (const m of (html.matchAll(fbVarRe))) {
    const c = extractCoordsFromUrl(safeDecodeURIComponent(m[1]));
    if (c) return c;
  }

  // 5. ── Any quoted string containing @lat,lng ────────────────────────────
  const quotedAt = html.match(/["'`][^"'`]*@(-?\d+\.\d+),(-?\d+\.\d+)[^"'`]*["'`]/);
  if (quotedAt) return coords(quotedAt[1], quotedAt[2], baseUrl);

  // 6. ── JSON lat/lng pairs ───────────────────────────────────────────────
  const json = html.match(/"lat"\s*:\s*(-?\d+\.\d{4,})[^}]{0,50}"lng"\s*:\s*(-?\d+\.\d{4,})/);
  if (json) return coords(json[1], json[2], baseUrl);

  // 7. ── Coordinate arrays (Taiwan range 21–26°N, 119–123°E) ─────────────
  const tw = html.match(/\[(2[1-6]\.\d{4,}),\s*(1(?:19|20|21|22|23)\.\d{4,})\]/);
  if (tw) return coords(tw[1], tw[2], baseUrl);

  return null;
}

// Extract coords from a comgooglemaps:// link
function extractCGMCoords(link) {
  // center=lat,lng (may be %2C instead of comma, already decoded above)
  const center = link.match(/[?&]center=(-?\d+\.\d+)[,](-?\d+\.\d+)/);
  if (center) return { lat: parseFloat(center[1]), lng: parseFloat(center[2]) };

  // ll=lat,lng
  const ll = link.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (ll) return { lat: parseFloat(ll[1]), lng: parseFloat(ll[2]) };

  // q=lat,lng (only if the q param looks like coordinates, not a place name)
  const q = link.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q && isValidLatLng(parseFloat(q[1]), parseFloat(q[2])))
    return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function coords(lat, lng, url) {
  const la = parseFloat(lat), lo = parseFloat(lng);
  if (!isValidLatLng(la, lo)) return null;
  return { lat: la, lng: lo, resolvedUrl: url };
}

function isValidLatLng(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0); // reject null island
}

function safeDecodeURIComponent(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function absoluteUrl(href, base) {
  try { return new URL(href, base).toString(); } catch { return href; }
}
