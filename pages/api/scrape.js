/**
 * GET /api/scrape?url=<instagram_url>
 * Attempts to extract Open Graph meta tags from an Instagram post URL.
 * Instagram actively blocks scraping; this is best-effort and may return nulls.
 */
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Validate it looks like a URL
  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl.toString(), {
      signal: controller.signal,
      headers: {
        // Impersonate a mobile Safari browser to maximise chance of getting OG tags
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
          'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Referer: 'https://www.instagram.com/',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.json({ image: null, description: null, title: null });
    }

    const html = await response.text();
    const og = extractOgTags(html);

    return res.json({
      image: og.image || null,
      description: og.description || null,
      title: og.title || null,
    });
  } catch (err) {
    // Timeout or network error — return empty rather than crashing
    return res.json({ image: null, description: null, title: null });
  }
}

/**
 * Extract all og: meta tag values from raw HTML using regex.
 * Handles both attribute orderings: property-first and content-first.
 */
function extractOgTags(html) {
  const result = {};
  const properties = ['image', 'description', 'title', 'site_name', 'url'];

  for (const prop of properties) {
    const value =
      getMetaContent(html, `og:${prop}`) ||
      getMetaContent(html, `twitter:${prop}`);
    if (value) result[prop] = decodeEntities(value);
  }

  return result;
}

function getMetaContent(html, property) {
  // Try: property="..." content="..."
  const r1 = new RegExp(
    `<meta[^>]+property=["']${escapeRegex(property)}["'][^>]+content=["']([^"']{1,2000})["']`,
    'i'
  );
  // Try: content="..." property="..."  (reversed order)
  const r2 = new RegExp(
    `<meta[^>]+content=["']([^"']{1,2000})["'][^>]+property=["']${escapeRegex(property)}["']`,
    'i'
  );
  // Also handle name= attribute (used by Twitter cards)
  const r3 = new RegExp(
    `<meta[^>]+name=["']${escapeRegex(property)}["'][^>]+content=["']([^"']{1,2000})["']`,
    'i'
  );
  const r4 = new RegExp(
    `<meta[^>]+content=["']([^"']{1,2000})["'][^>]+name=["']${escapeRegex(property)}["']`,
    'i'
  );

  const match = html.match(r1) || html.match(r2) || html.match(r3) || html.match(r4);
  return match ? match[1] : null;
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
