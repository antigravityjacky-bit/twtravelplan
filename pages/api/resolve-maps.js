/**
 * GET /api/resolve-maps?url=<google_maps_url>
 *
 * Resolves a Google Maps URL (including maps.app.goo.gl Firebase Dynamic Links)
 * and extracts lat/lng coordinates.
 *
 * maps.app.goo.gl links are Firebase Dynamic Links — they return a 200 HTML page
 * with JavaScript that redirects the browser. Node fetch won't execute that JS,
 * so we must scan the HTML for embedded Google Maps URLs with coordinates.
 */

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  // Try desktop UA first — more likely to get a clean web redirect
  const result =
    (await tryResolve(url, DESKTOP_UA)) ||
    (await tryResolve(url, MOBILE_UA));

  if (result?.lat != null) return res.json(result);
  return res.json({ error: 'Could not extract coordinates from this link' });
}

async function tryResolve(url, ua) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    // ── Strategy 1: HTTP redirect (Location header) ───────────────────────
    try {
      const r1 = await fetch(url, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': ua },
      });
      if (r1.status >= 300 && r1.status < 400) {
        const loc = r1.headers.get('location');
        if (loc) {
          const coords = extractCoords(resolveUrl(loc, url));
          if (coords) { clearTimeout(timeout); return coords; }
        }
      }
    } catch { /* continue */ }

    // ── Strategy 2: Follow redirects, check response.url ─────────────────
    const r2 = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': ua },
    });
    clearTimeout(timeout);

    const finalUrl = r2.url;
    const urlCoords = extractCoords(finalUrl);
    if (urlCoords) return urlCoords;

    // ── Strategy 3: Scan HTML for embedded Google Maps URLs ───────────────
    // maps.app.goo.gl is a Firebase Dynamic Link — a 200 HTML page with JS
    // that redirects. The destination URL is embedded in the HTML source.
    const html = await r2.text();
    return extractCoordsFromHtml(html, finalUrl);
  } catch {
    return null;
  }
}

// ─── Coordinate extraction helpers ────────────────────────────────────────

function extractCoords(url) {
  if (!url) return null;
  const decoded = safeDecodeURI(url);

  // @lat,lng[,zoom] — standard Google Maps format
  const at = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]), resolvedUrl: url };

  // ?q=lat,lng
  const q = decoded.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]), resolvedUrl: url };

  // ?ll=lat,lng
  const ll = decoded.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (ll) return { lat: parseFloat(ll[1]), lng: parseFloat(ll[2]), resolvedUrl: url };

  return null;
}

function extractCoordsFromHtml(html, baseUrl) {
  // 1. All google.com/maps URLs embedded in the HTML (JavaScript, links, etc.)
  const mapUrlRe = /https?:\/\/(?:www\.)?(?:maps\.google\.com|google\.com\/maps)[^\s"'<>\\]*/g;
  const candidates = html.match(mapUrlRe) || [];
  for (const u of candidates) {
    const coords = extractCoords(safeDecodeURI(u));
    if (coords) return coords;
  }

  // 2. Firebase Dynamic Link patterns — the destination URL in JS variables
  const patterns = [
    // continueUrl = "https://www.google.com/maps/..."
    /(?:continueUrl|deepLinkUrl|redirectUrl|fallbackUrl)\s*[=:]\s*["']([^"']+google\.com\/maps[^"']+)["']/i,
    // Any quoted string containing google.com/maps/@lat,lng
    /["'`](https?:\/\/[^"'`]*google\.com\/maps[^"'`]*@-?\d+\.\d+,-?\d+\.\d+[^"'`]*)["'`]/,
    // Unquoted URL in a script src or meta content
    /content=["']?([^"'\s]*google\.com\/maps[^"'\s]*)["']?/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const coords = extractCoords(safeDecodeURI(m[1]));
      if (coords) return coords;
    }
  }

  // 3. Raw coordinate arrays in JSON/JS data — Taiwan lat range 21-26, lng range 119-122
  const twCoord = html.match(/\[(2[1-6]\.\d{4,}),\s*(1(?:19|20|21|22)\.\d{4,})\]/);
  if (twCoord) {
    return {
      lat: parseFloat(twCoord[1]),
      lng: parseFloat(twCoord[2]),
      resolvedUrl: baseUrl,
    };
  }

  // 4. Generic JSON lat/lng
  const jsonCoord = html.match(/"lat"\s*:\s*(-?\d+\.\d{4,})[^}]*"lng"\s*:\s*(-?\d+\.\d{4,})/);
  if (jsonCoord) {
    return {
      lat: parseFloat(jsonCoord[1]),
      lng: parseFloat(jsonCoord[2]),
      resolvedUrl: baseUrl,
    };
  }

  return null;
}

function safeDecodeURI(str) {
  try { return decodeURIComponent(str); } catch { return str; }
}

function resolveUrl(href, base) {
  try { return new URL(href, base).toString(); } catch { return href; }
}
