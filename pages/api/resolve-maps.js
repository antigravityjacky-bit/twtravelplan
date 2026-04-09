/**
 * GET /api/resolve-maps?url=<google_maps_url>
 * Resolves a Google Maps short URL (maps.app.goo.gl / goo.gl/maps) by following
 * redirects server-side, then extracts lat/lng from the final URL.
 */
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
          'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html',
      },
    });
    clearTimeout(timeout);

    const finalUrl = response.url;

    // 1. Try @lat,lng pattern in the final URL
    const atMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return res.json({
        lat: parseFloat(atMatch[1]),
        lng: parseFloat(atMatch[2]),
        resolvedUrl: finalUrl,
      });
    }

    // 2. Scan the HTML for coordinate patterns Google embeds in the page
    const html = await response.text();

    // Pattern: [lat, lng] arrays Google puts in initialisation data
    // Looks for two consecutive numbers in the Taiwan lat/lng range
    const twPattern = html.match(/\[(2[0-4]\.\d{4,}),(12[0-2]\.\d{4,})\]/);
    if (twPattern) {
      return res.json({
        lat: parseFloat(twPattern[1]),
        lng: parseFloat(twPattern[2]),
        resolvedUrl: finalUrl,
      });
    }

    // Generic lat/lng in JSON: "lat":25.0478,"lng":121.5319
    const jsonMatch = html.match(/"lat"\s*:\s*(-?\d+\.\d+).*?"lng"\s*:\s*(-?\d+\.\d+)/);
    if (jsonMatch) {
      return res.json({
        lat: parseFloat(jsonMatch[1]),
        lng: parseFloat(jsonMatch[2]),
        resolvedUrl: finalUrl,
      });
    }

    return res.json({ error: 'Could not extract coordinates', resolvedUrl: finalUrl });
  } catch {
    return res.json({ error: 'Failed to resolve URL' });
  }
}
