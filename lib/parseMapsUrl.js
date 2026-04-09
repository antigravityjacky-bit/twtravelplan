/**
 * Parse coordinates and place info from Google Maps URLs.
 * Handles both full URLs and short URLs (maps.app.goo.gl).
 */

/**
 * Try to extract lat/lng directly from a Google Maps URL string.
 * Returns { lat, lng } or null if not possible (e.g. short URL needs server resolution).
 */
export function parseMapsCoords(url) {
  if (!url) return null;

  // Standard format: @lat,lng,zoom  e.g. @25.0478,121.5319,17z
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

  // Query format: ?q=lat,lng  or  &q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

  // ll= format sometimes used
  const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };

  return null;
}

/**
 * Try to extract the place name from a Google Maps URL path.
 * e.g. /maps/place/阜杭豆漿/@... → "阜杭豆漿"
 */
export function parseMapsPlaceName(url) {
  if (!url) return null;
  const m = url.match(/\/maps\/(?:place|search)\/([^/@?&+]{2,})/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
  } catch {
    return null;
  }
}

export function isShortMapsUrl(url) {
  return !!(url && (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')));
}

export function isGoogleMapsUrl(url) {
  return !!(url && (
    url.includes('google.com/maps') ||
    url.includes('maps.google.com') ||
    url.includes('maps.app.goo.gl') ||
    url.includes('goo.gl/maps')
  ));
}

/**
 * Parse lat/lng from an OpenStreetMap URL.
 * Handles:
 *   https://www.openstreetmap.org/#map=15/25.0478/121.5319
 *   https://www.openstreetmap.org/?mlat=25.0478&mlon=121.5319
 */
export function parseOSMCoords(url) {
  if (!url) return null;

  // Hash fragment: #map=zoom/lat/lng
  const hash = url.match(/#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/);
  if (hash) return { lat: parseFloat(hash[1]), lng: parseFloat(hash[2]) };

  // Marker params: ?mlat=lat&mlon=lng
  const mlat = url.match(/[?&]mlat=(-?\d+\.\d+)/);
  const mlon = url.match(/[?&]mlon=(-?\d+\.\d+)/);
  if (mlat && mlon) return { lat: parseFloat(mlat[1]), lng: parseFloat(mlon[1]) };

  return null;
}

export function isOSMUrl(url) {
  return !!(url && url.includes('openstreetmap.org'));
}
