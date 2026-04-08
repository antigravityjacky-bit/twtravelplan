/**
 * Caption parsing utilities for Instagram post/reel auto-capture.
 * All functions are pure — no side effects, no network calls.
 */

// ─── Category detection ────────────────────────────────────────────────────

const CATEGORY_KEYWORDS = {
  Breakfast: ['breakfast', 'morningfood', '早餐', '早午餐', 'brunch', 'morning'],
  Cafe: ['cafe', 'coffee', 'latte', 'espresso', 'cappuccino', 'matcha', '咖啡', '咖啡廳', '下午茶'],
  Restaurant: [
    'food', 'restaurant', 'dining', 'eat', 'foodie', 'dinner', 'lunch', 'noodle',
    'ramen', 'sushi', 'hotpot', '美食', '餐廳', '好吃', '吃飯', '晚餐', '午餐', '火鍋', '拉麵',
  ],
  Bar: ['bar', 'cocktail', 'nightlife', 'pub', 'beer', '酒吧', '調酒', '夜店', 'nightclub'],
  Hotel: ['hotel', 'resort', 'stay', 'checkin', 'checkout', '住宿', '飯店', '酒店', '旅館'],
  Attraction: [
    'travel', 'scenic', 'view', 'landmark', 'museum', 'temple', 'hiking', 'nature',
    'explore', 'sightseeing', '旅遊', '景點', '打卡', '觀光', '廟', '公園', '夜景',
  ],
};

export function detectCategory(text) {
  const lower = text.toLowerCase();
  const hashtags = (text.match(/#\w+/g) || []).map((t) => t.slice(1).toLowerCase());
  const combined = lower + ' ' + hashtags.join(' ');

  const scores = {};
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[category] = keywords.filter((kw) => combined.includes(kw)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] > 0) {
    return { category: best[0], confidence: best[1] >= 2 ? 'high' : 'low' };
  }
  return { category: 'Attraction', confidence: 'none' };
}

// ─── Instagram-specific description cleaning ───────────────────────────────

/**
 * Instagram og:description often has one of these formats:
 *   "@username: actual caption text #hashtags"
 *   "X likes, Y comments - @username on Instagram: "caption""
 *   "username's Reel: actual caption"
 *   "Watch this reel by @username on Instagram"  ← generic/useless
 *
 * This function strips those prefixes and returns the actual caption.
 */
export function cleanInstagramDescription(raw) {
  if (!raw) return '';

  let text = raw.trim();

  // Strip "X likes, Y comments - ... on Instagram: " prefix
  text = text.replace(/^\d[\d,]*\s+likes?,\s+\d[\d,]*\s+comments?\s*[-–][^:]+:\s*/i, '');

  // Strip "@username: " prefix (Reels format)
  text = text.replace(/^@[\w.]+:\s*/u, '');

  // Strip "username's Reel: " prefix
  text = text.replace(/^[\w.\s]+'s\s+Reel:\s*/iu, '');

  // Strip "username's Post: " prefix
  text = text.replace(/^[\w.\s]+'s\s+Post:\s*/iu, '');

  // Strip leading/trailing quotes that Instagram sometimes wraps around captions
  text = text.replace(/^[""](.+)[""]$/s, '$1');

  // Remove trailing "... More" that Instagram adds to truncated captions
  text = text.replace(/\s*\u2026?\s*More\s*$/i, '').trim();

  return text;
}

// ─── Place name extraction ─────────────────────────────────────────────────

const NAME_PATTERNS = [
  // 📍 Place Name  or  📍Place Name
  /📍\s*([^\n#@,]{3,50})/u,
  // at Place Name / at @PlaceName
  /\bat\s+@?([A-Z][A-Za-z0-9'\s&.-]{2,40})/,
  // visited/dined/stayed/was at Place
  /(?:visited|dined at|stayed at|was at|checked in at)\s+([A-Z][A-Za-z0-9'\s&.-]{2,40})/i,
  // Chinese: 在 X 吃/玩/住
  /在([^\s#@,，。！]{2,20})(?:吃|喝|玩|住|打卡)/u,
  // "Place Name" in quotes
  /"([^"]{3,50})"/,
  // 【Place Name】
  /【([^】]{3,30})】/u,
];

export function extractName(text) {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const candidate = match[1].trim().replace(/[,#\n].*$/, '').trim();
      if (candidate.length >= 2) return candidate;
    }
  }
  return null;
}

// ─── Location / area extraction ────────────────────────────────────────────

const LOCATION_PATTERNS = [
  // "Central, HK" / "信義區, 台北"
  /([A-Z][a-zA-Z\s]+,\s*(?:Taipei|Taichung|Tainan|Kaohsiung|Taiwan|HK|Hong Kong))/i,
  // Chinese area names: 信義區, 大安區, 台北市, etc.
  /([^\s#@，。！\n]{2,8}(?:區|市|縣|鄉|鎮))/u,
  // City names standalone
  /\b(Taipei|Taichung|Tainan|Kaohsiung|Hualien|Keelung|台北|台中|台南|高雄|花蓮|基隆)\b/iu,
];

export function extractLocation(text) {
  for (const pattern of LOCATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const candidate = match[1].trim();
      if (candidate.length >= 2) return candidate;
    }
  }
  return null;
}

// ─── Hashtag extraction ────────────────────────────────────────────────────

export function extractHashtags(text) {
  return (text.match(/#[\w\u4e00-\u9fff]+/gu) || []).map((t) => t.slice(1));
}

// ─── Main parse function ───────────────────────────────────────────────────

/**
 * Parse an Instagram caption (og:description text) and return structured data
 * with confidence levels.
 */
export function parseCaption(rawText) {
  if (!rawText) {
    return {
      name: null, nameConfidence: 'none',
      location: null, locationConfidence: 'none',
      category: 'Attraction', categoryConfidence: 'none',
      hashtags: [],
      description: '',
    };
  }

  // Clean Instagram-specific prefixes first
  const text = cleanInstagramDescription(rawText);

  if (!text) {
    return {
      name: null, nameConfidence: 'none',
      location: null, locationConfidence: 'none',
      category: 'Attraction', categoryConfidence: 'none',
      hashtags: [],
      description: '',
    };
  }

  const name = extractName(text);
  const location = extractLocation(text);
  const { category, confidence: categoryConfidence } = detectCategory(text);
  const hashtags = extractHashtags(text);

  // Strip hashtags from description for cleaner display
  const description = text.replace(/#[\w\u4e00-\u9fff]+/gu, '').replace(/\s{2,}/g, ' ').trim();

  return {
    name,
    nameConfidence: name ? 'low' : 'none',
    location,
    locationConfidence: location ? 'low' : 'none',
    category,
    categoryConfidence,
    hashtags,
    description,
  };
}
