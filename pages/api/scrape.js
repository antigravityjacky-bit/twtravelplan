/**
 * GET /api/scrape?url=<instagram_url>
 * Attempts to extract Open Graph meta tags from an Instagram post or Reel URL.
 * Instagram actively blocks scraping; this is best-effort and may return nulls.
 *
 * Strategy (in order):
 *  1. Fetch the main URL with a mobile Safari UA
 *  2. If description is missing/generic, retry with the /embed/ variant
 */
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const og = await tryFetch(targetUrl.toString());

  // If description looks generic, also try the /embed/ variant which often
  // contains the full caption for Reels
  const isGeneric =
    !og.description ||
    /watch this reel|view this post|a post shared/i.test(og.description);

  if (isGeneric) {
    const embedUrl = buildEmbedUrl(targetUrl);
    if (embedUrl) {
      const ogEmbed = await tryFetch(embedUrl);
      if (ogEmbed.description && !isGenericDescription(ogEmbed.description)) {
        og.description = ogEmbed.description;
      }
      // Keep original image if embed doesn't have one
      if (!og.image && ogEmbed.image) og.image = ogEmbed.image;
      if (!og.title && ogEmbed.title) og.title = ogEmbed.title;
    }
  }

  return res.json({
    image: og.image || null,
    description: og.description || null,
    title: og.title || null,
  });
}

// Build /embed/ URL for Instagram posts and Reels
function buildEmbedUrl(url) {
  // /p/XXXX/ → /p/XXXX/embed/
  // /reel/XXXX/ → /reel/XXXX/embed/
  const path = url.pathname.replace(/\/?$/, '/embed/');
  if (!path.match(/^\/(p|reel)\//)) return null;
  return `${url.origin}${path}`;
}

function isGenericDescription(desc) {
  return /watch this reel|view this post|a post shared/i.test(desc);
}

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function tryFetch(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': MOBILE_UA,
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
    if (!response.ok) return {};

    const html = await response.text();
    return extractOgTags(html);
  } catch {
    return {};
  }
}

function extractOgTags(html) {
  const result = {};
  const properties = ['image', 'description', 'title'];

  for (const prop of properties) {
    const value =
      getMetaContent(html, `og:${prop}`) ||
      getMetaContent(html, `twitter:${prop}`) ||
      (prop === 'description' ? getMetaContent(html, 'description') : null) ||
      (prop === 'title' ? getTagContent(html, 'title') : null);
    if (value) result[prop] = decodeEntities(value.trim());
  }

  return result;
}

function getMetaContent(html, property) {
  const patterns = [
    // property="..." content="..."
    new RegExp(`<meta[^>]+property=["']${escapeRegex(property)}["'][^>]+content=["']([^"']{1,3000})["']`, 'i'),
    // content="..." property="..."
    new RegExp(`<meta[^>]+content=["']([^"']{1,3000})["'][^>]+property=["']${escapeRegex(property)}["']`, 'i'),
    // name="..." content="..."
    new RegExp(`<meta[^>]+name=["']${escapeRegex(property)}["'][^>]+content=["']([^"']{1,3000})["']`, 'i'),
    // content="..." name="..."
    new RegExp(`<meta[^>]+content=["']([^"']{1,3000})["'][^>]+name=["']${escapeRegex(property)}["']`, 'i'),
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function getTagContent(html, tag) {
  const m = html.match(new RegExp(`<${tag}[^>]*>([^<]{1,300})</${tag}>`, 'i'));
  return m ? m[1] : null;
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
