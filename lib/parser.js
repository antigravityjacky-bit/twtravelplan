/**
 * Caption parsing utilities for Instagram post auto-capture.
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

// ─── Place name extraction ─────────────────────────────────────────────────

// Patterns to extract a place name from caption text
const NAME_PATTERNS = [
  // 📍 Place Name  or  📍Place Name
  /📍\s*([^\n#@,]{3,50})/u,
  // at Place Name / at @PlaceName / @ Place Name
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

// Common area patterns to look for in captions
const LOCATION_PATTERNS = [
  // "Central, HK" / "信義區, 台北" style
  /([A-Z][a-zA-Z\s]+,\s*(?:Taipei|Taichung|Tainan|Kaohsiung|Taiwan|HK|Hong Kong))/i,
  // Chinese area names followed by 區/市/縣
  /([^\s#@，。！\n]{2,8}(?:區|市|縣|鄉|鎮))/u,
  // "Taipei" / "台北" standalone
  /\b(Taipei|Taichung|Tainan|Kaohsiung|Hualien|Keelung|台北|台中|台南|高雄|花蓮|基隆)\b/iu,
  // After 📍 when name pattern already consumed it — try next segment
  /📍[^,\n#]{3,40},\s*([^,\n#]{3,30})/u,
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
 * Parse an Instagram caption and return structured data with confidence levels.
 *
 * @param {string} text - The raw caption / og:description text
 * @returns {{
 *   name: string|null, nameConfidence: 'low'|'none',
 *   location: string|null, locationConfidence: 'low'|'none',
 *   category: string, categoryConfidence: 'high'|'low'|'none',
 *   hashtags: string[],
 *   description: string,
 * }}
 */
export function parseCaption(text) {
  if (!text) {
    return {
      name: null, nameConfidence: 'none',
      location: null, locationConfidence: 'none',
      category: 'Attraction', categoryConfidence: 'none',
      hashtags: [],
      description: '',
    };
  }

  // Instagram og:description often starts with "X likes, Y comments - actual caption"
  const cleanText = text.replace(/^\d[\d,]*\s+likes?,\s+\d[\d,]*\s+comments?\s*[-–]\s*/i, '').trim();

  const name = extractName(cleanText);
  const location = extractLocation(cleanText);
  const { category, confidence: categoryConfidence } = detectCategory(cleanText);
  const hashtags = extractHashtags(cleanText);

  // Strip hashtags from description to keep it clean
  const description = cleanText.replace(/#[\w\u4e00-\u9fff]+/gu, '').replace(/\s{2,}/g, ' ').trim();

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
