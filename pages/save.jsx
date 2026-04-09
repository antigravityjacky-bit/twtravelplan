import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { usePlaces } from '../hooks/usePlaces';
import { parseCaption } from '../lib/parser';
import { searchPlaces } from '../lib/geocode';
import {
  parseMapsCoords, parseMapsPlaceName,
  isGoogleMapsUrl, parseOSMCoords, isOSMUrl,
} from '../lib/parseMapsUrl';

// Load the pin map dynamically (Leaflet requires no SSR)
const SaveMap = dynamic(() => import('../components/SaveMap'), { ssr: false });

const CATEGORIES = ['Breakfast', 'Cafe', 'Restaurant', 'Attraction', 'Hotel', 'Bar'];
const CATEGORY_ACTIVE = {
  Breakfast:  'bg-amber-400 text-white border-amber-400',
  Cafe:       'bg-stone-500 text-white border-stone-500',
  Restaurant: 'bg-orange-500 text-white border-orange-500',
  Attraction: 'bg-blue-500 text-white border-blue-500',
  Hotel:      'bg-violet-500 text-white border-violet-500',
  Bar:        'bg-rose-500 text-white border-rose-500',
};
const CATEGORY_EMOJI = {
  Breakfast: '🍳', Cafe: '☕', Restaurant: '🍽️', Attraction: '🗺️', Hotel: '🏨', Bar: '🍸',
};

const EMPTY_FORM = {
  name: '', category: 'Attraction', address: '',
  description: '', lat: null, lng: null, image_url: '', ig_url: '', notes: '',
};

// Confidence badge component
function Badge({ confidence, labels = {} }) {
  if (confidence === 'high') return (
    <span className="text-xs text-emerald-600 flex items-center gap-0.5">✅ {labels.high ?? '自動填入'}</span>
  );
  if (confidence === 'low') return (
    <span className="text-xs text-amber-500 flex items-center gap-0.5">⚠️ {labels.low ?? '請確認'}</span>
  );
  if (confidence === 'manual') return (
    <span className="text-xs text-blue-500 flex items-center gap-0.5">📍 {labels.manual ?? '手動選擇'}</span>
  );
  if (confidence === 'optional') return (
    <span className="text-xs text-slate-400 flex items-center gap-0.5">✏️ {labels.optional ?? '可選填'}</span>
  );
  return <span className="text-xs text-rose-500 flex items-center gap-0.5">❌ {labels.none ?? '請手動填寫'}</span>;
}

export default function SavePage() {
  const router = useRouter();
  const { addPlace } = usePlaces();

  const [igUrl, setIgUrl] = useState('');
  const [scrapeStatus, setScrapeStatus] = useState('idle'); // idle | loading | done | error
  const [form, setForm] = useState(EMPTY_FORM);
  const [confidence, setConfidence] = useState({});
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [isStandalone, setIsStandalone] = useState(null);
  const [clipboardPrompt, setClipboardPrompt] = useState(null);

  // Location search state
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locationUrl, setLocationUrl] = useState('');
  const [urlImporting, setUrlImporting] = useState(false);

  const hasAutoFetched = useRef(false);

  // Detect standalone mode + auto-read clipboard when opened as PWA
  useEffect(() => {
    const standalone = !!window.navigator.standalone;
    setIsStandalone(standalone);

    if (!standalone) return;
    if (hasAutoFetched.current) return;
    navigator.clipboard.readText().then((text) => {
      const trimmed = text?.trim();
      if (trimmed && trimmed.includes('instagram.com') && !hasAutoFetched.current) {
        setClipboardPrompt({ url: trimmed });
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Extract URL from router.query (Web Share Target or manual) ────────────
  useEffect(() => {
    if (!router.isReady) return;
    const { url, text } = router.query;
    const shared = url || (text && text.startsWith('http') ? text : null);
    if (shared && !hasAutoFetched.current) {
      setIgUrl(shared);
      hasAutoFetched.current = true;
      runCapture(shared);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query]);

  // ── Auto-capture pipeline ─────────────────────────────────────────────────
  const runCapture = useCallback(async (url) => {
    setScrapeStatus('loading');
    setImgError(false);
    const newConf = {};
    const newForm = { ...EMPTY_FORM, ig_url: url };

    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
      const og = await res.json();
      const parsed = parseCaption(og.description || '');

      if (og.image) {
        newForm.image_url = og.image;
        newConf.image = 'high';
      } else {
        newConf.image = 'none';
      }

      if (parsed.description) {
        newForm.description = parsed.description.slice(0, 300);
        newConf.description = 'low';
      } else {
        newConf.description = 'none';
      }

      newForm.category = parsed.category;
      newConf.category = parsed.categoryConfidence;
      newConf.coords = 'none';

      setForm(newForm);
      setConfidence(newConf);
      setScrapeStatus('done');
    } catch {
      setForm((f) => ({ ...f, ig_url: url }));
      setScrapeStatus('error');
      showToast('抓取失敗，請手動填寫', 'error');
    }
  }, []);

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (!trimmed) { showToast('剪貼簿是空的', 'error'); return; }
      setIgUrl(trimmed);
      runCapture(trimmed);
    } catch {
      showToast('無法讀取剪貼簿，請手動貼入連結', 'error');
    }
  }

  function handleUrlSubmit(e) {
    e.preventDefault();
    if (!igUrl.trim()) return;
    runCapture(igUrl.trim());
  }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleMapClick(lat, lng) {
    setForm((f) => ({ ...f, lat, lng }));
    setConfidence((c) => ({ ...c, coords: 'manual' }));
    setSearchResults([]);
  }

  // ── Nominatim place search ────────────────────────────────────────────────
  async function handleSearch() {
    const query = form.name.trim();
    if (!query) return;
    setSearching(true);
    setSearchResults([]);
    const results = await searchPlaces(query + ' Taiwan');
    setSearching(false);
    if (results.length === 0) {
      showToast('找不到結果，試試更完整名稱', 'error');
    } else {
      setSearchResults(results);
    }
  }

  function applySearchResult(r) {
    setForm((f) => ({ ...f, lat: r.lat, lng: r.lng, address: r.label }));
    setConfidence((c) => ({ ...c, coords: 'low' }));
    setErrors((e) => ({ ...e, coords: undefined }));
    setSearchResults([]);
  }

  // ── URL paste-back (OSM or Google Maps) ──────────────────────────────────
  async function handleUrlImport() {
    const url = locationUrl.trim();
    if (!url) return;
    setUrlImporting(true);

    // 1. OSM URL — parse directly, no server needed
    if (isOSMUrl(url)) {
      const c = parseOSMCoords(url);
      if (c) {
        applyUrlResult(c, url);
      } else {
        showToast('無法解析 OSM 連結。請確認 URL 含 #map=zoom/lat/lng', 'error');
      }
      setUrlImporting(false);
      return;
    }

    // 2. Google Maps — direct parse or server resolve
    const direct = parseMapsCoords(url);
    if (direct) { applyUrlResult(direct, url); setUrlImporting(false); return; }

    if (isGoogleMapsUrl(url)) {
      try {
        const res = await fetch(`/api/resolve-maps?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.lat) {
          applyUrlResult({ lat: data.lat, lng: data.lng }, data.resolvedUrl || url);
        } else {
          showToast('短網址無法解析。請複製完整 URL（含 @lat,lng）', 'error');
        }
      } catch {
        showToast('解析失敗，請稍後再試', 'error');
      }
    } else {
      showToast('請貼入 OpenStreetMap 或 Google Maps 連結', 'error');
    }

    setUrlImporting(false);
  }

  function applyUrlResult({ lat, lng }, sourceUrl) {
    setForm((f) => {
      const fromUrl = parseMapsPlaceName(sourceUrl);
      return { ...f, lat, lng, address: f.address || fromUrl || f.address };
    });
    setConfidence((c) => ({ ...c, coords: 'high' }));
    setErrors((e) => ({ ...e, coords: undefined }));
    setLocationUrl('');
    setSearchResults([]);
    showToast('✅ 位置已套用');
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = '必填';
    if (form.lat == null || form.lng == null) e.coords = '請搜尋位置或點選地圖';
    return e;
  }

  async function handleSave(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);

    const base = {
      name:        form.name.trim(),
      category:    form.category,
      address:     form.address.trim(),
      description: form.description.trim(),
      lat:         form.lat,
      lng:         form.lng,
    };

    let result = await addPlace({ ...base, image_url: form.image_url.trim(), ig_url: form.ig_url.trim() });

    const missingColumn = result.error &&
      (result.error.includes('ig_url') || result.error.includes('image_url') || result.error.includes('schema cache'));
    if (missingColumn) {
      result = await addPlace(base);
      if (!result.error) {
        setSaving(false);
        showToast('已儲存！（提示：執行 Supabase SQL 可儲存圖片連結）');
        setTimeout(() => router.push('/'), 1800);
        return;
      }
    }

    setSaving(false);
    if (result.error) {
      showToast(`儲存失敗：${result.error}`, 'error');
    } else {
      showToast('已儲存！正在跳轉到地圖...');
      setTimeout(() => router.push('/'), 1200);
    }
  }

  const isLoading = scrapeStatus === 'loading';
  const osmSearchUrl = form.name.trim()
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(form.name.trim() + ' Taiwan')}`
    : null;

  return (
    <>
      <Head>
        <title>📸 儲存地點 — Taiwan Trip</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white ${
          toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="min-h-screen bg-slate-50 font-sans">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-slate-400 hover:text-slate-600 text-sm">← 地圖</Link>
              <span className="text-slate-200">|</span>
              <h1 className="font-bold text-slate-800">📸 儲存 IG 地點</h1>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

          {/* ── Step 1: IG URL Input ── */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="text-xl">📱</span>
              Instagram 連結
            </h2>

            {/* Clipboard prompt */}
            {clipboardPrompt && scrapeStatus === 'idle' && (
              <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs font-semibold text-emerald-800 mb-1">📋 偵測到剪貼簿中的 IG 連結</p>
                <p className="text-xs text-emerald-600 mb-3 break-all line-clamp-2">{clipboardPrompt.url}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const url = clipboardPrompt.url;
                      setClipboardPrompt(null);
                      hasAutoFetched.current = true;
                      setIgUrl(url);
                      runCapture(url);
                    }}
                    className="flex-1 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 transition-colors"
                  >
                    ✅ 開始抓取
                  </button>
                  <button
                    onClick={() => setClipboardPrompt(null)}
                    className="px-4 py-2.5 border border-slate-200 text-sm text-slate-500 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    忽略
                  </button>
                </div>
              </div>
            )}

            {/* Non-PWA hint */}
            {isStandalone === false && scrapeStatus === 'idle' && !igUrl && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                <p className="font-semibold mb-1">⚠️ 正在 Safari 瀏覽器開啟（非 App 模式）</p>
                <p className="mb-1.5">最可靠方法：複製連結 → 回來按「貼上」按鈕。</p>
                <details>
                  <summary className="cursor-pointer text-amber-700 font-medium">想從 IG 分享直接打開？（需安裝）</summary>
                  <ol className="list-decimal list-inside space-y-0.5 mt-1.5">
                    <li>用 <strong>Safari</strong> 打開此網站</li>
                    <li>底部 □↑ → 向下滑找「<strong>加入主畫面</strong>」</li>
                    <li>從主畫面圖示開啟一次</li>
                    <li>Instagram → 分享 → 更多 → 找「TW Trip」啟用</li>
                  </ol>
                </details>
              </div>
            )}

            {/* Usage hint */}
            {!igUrl && scrapeStatus === 'idle' && !clipboardPrompt && (
              <div className="mb-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 leading-relaxed">
                <p className="font-semibold mb-1">📱 使用方法</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Instagram Reel → 右下「分享」→「複製連結」</li>
                  <li>回到這裡 → 按「📋 貼上 IG 連結」</li>
                </ol>
                {isStandalone && (
                  <p className="mt-1.5 text-emerald-600 font-medium">✅ App 模式：複製連結後開啟 app 會自動偵測</p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handlePasteFromClipboard}
              disabled={isLoading}
              className="w-full mb-3 py-3 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              📋 貼上 IG 連結（自動抓取）
            </button>

            <form onSubmit={handleUrlSubmit} className="flex gap-2">
              <input
                value={igUrl}
                onChange={(e) => setIgUrl(e.target.value)}
                placeholder="或手動貼入連結..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-300 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
              <button
                type="submit"
                disabled={isLoading || !igUrl.trim()}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-100 transition-colors disabled:opacity-40 flex-shrink-0"
              >
                {isLoading ? '⏳' : '↵'}
              </button>
            </form>

            {isLoading && (
              <div className="mt-4 flex items-center gap-3 text-sm text-slate-500">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin flex-shrink-0" />
                <span>正在抓取圖片和資訊，約 2–5 秒...</span>
              </div>
            )}
          </section>

          {/* ── Form (shown after scrape attempt) ── */}
          {(scrapeStatus === 'done' || scrapeStatus === 'error') && (
            <form onSubmit={handleSave} className="space-y-5">

              {/* ── Captured info: image + category + description ── */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Image */}
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <h2 className="text-sm font-semibold text-slate-700">📸 自動抓取資訊</h2>
                  <Badge confidence={confidence.image ?? 'none'} labels={{ high: '圖片已抓取', none: '未找到圖片' }} />
                </div>

                {form.image_url && !imgError ? (
                  <img
                    src={form.image_url}
                    alt="Instagram post"
                    className="w-full max-h-64 object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="mx-5 mb-2 h-28 bg-slate-100 rounded-xl flex items-center justify-center">
                    <span className="text-4xl opacity-30">📷</span>
                  </div>
                )}

                <div className="px-5 pb-4 space-y-4 pt-3">
                  {/* Image URL override */}
                  <input
                    value={form.image_url}
                    onChange={(e) => { set('image_url', e.target.value); setImgError(false); }}
                    placeholder="圖片 URL（可手動修改）"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400 text-slate-600 placeholder-slate-300"
                  />

                  {/* Category */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-700">🏷️ 分類</label>
                      <Badge
                        confidence={confidence.category ?? 'none'}
                        labels={{ high: '自動偵測', low: '請確認', none: '請選擇' }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => { set('category', cat); setConfidence((c) => ({ ...c, category: 'manual' })); }}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                            form.category === cat
                              ? CATEGORY_ACTIVE[cat]
                              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          {CATEGORY_EMOJI[cat]} {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-700">📝 描述</label>
                      <Badge confidence={confidence.description ?? 'optional'} labels={{ low: '從 caption 擷取', optional: '可選填' }} />
                    </div>
                    <textarea
                      value={form.description}
                      onChange={(e) => set('description', e.target.value)}
                      rows={3}
                      placeholder="地點簡介..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-300 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 resize-none"
                    />
                  </div>
                </div>
              </section>

              {/* ── Location section ── */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">🗺️ 位置</label>
                  <Badge
                    confidence={confidence.coords ?? 'none'}
                    labels={{ high: '已確認', low: '自動定位（請確認）', manual: '手動選擇', none: '請搜尋或點地圖' }}
                  />
                </div>

                {/* Name input — required, also used as search query */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">店名 / 地點 *</label>
                  <input
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                    placeholder="例：阜杭豆漿"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-300 outline-none transition-all ${
                      errors.name ? 'border-rose-300 focus:ring-2 focus:ring-rose-100' : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
                    }`}
                  />
                  {errors.name && <p className="text-xs text-rose-500">{errors.name}</p>}
                </div>

                {/* Search + OSM open buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={searching || !form.name.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {searching
                      ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : '🔍'}
                    {searching ? '搜尋中...' : '搜尋位置'}
                  </button>
                  <a
                    href={osmSearchUrl ?? undefined}
                    onClick={(e) => { if (!osmSearchUrl) e.preventDefault(); }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-center transition-colors ${
                      osmSearchUrl
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    🌐 OpenStreetMap
                  </a>
                </div>

                {/* Nominatim results list */}
                {searchResults.length > 0 && (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                    {searchResults.map((r, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => applySearchResult(r)}
                          className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-blue-50 transition-colors"
                        >
                          <span className="text-blue-500 font-medium">📍 </span>{r.label}
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        onClick={() => setSearchResults([])}
                        className="w-full text-center px-3.5 py-2 text-xs text-slate-400 hover:bg-slate-50 transition-colors"
                      >
                        ✕ 關閉
                      </button>
                    </li>
                  </ul>
                )}

                {/* URL paste-back (OSM or Google Maps) */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">
                    或貼入地圖連結（OpenStreetMap / Google Maps）
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    在 OpenStreetMap 找到位置後，複製網址列 URL（含 <code className="bg-slate-200 px-1 rounded">#map=</code>）→ 貼在這裡
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={locationUrl}
                      onChange={(e) => setLocationUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUrlImport(); } }}
                      placeholder="貼入 OSM 或 Google Maps 連結..."
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    />
                    <button
                      type="button"
                      onClick={handleUrlImport}
                      disabled={!locationUrl.trim() || urlImporting}
                      className="px-3.5 py-2 bg-blue-500 text-white text-xs font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-40 flex-shrink-0 flex items-center gap-1"
                    >
                      {urlImporting
                        ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : '✓'}
                      {urlImporting ? '解析中' : '套用'}
                    </button>
                  </div>
                </div>

                {/* Map */}
                <div className={`rounded-xl overflow-hidden border ${errors.coords ? 'border-rose-300' : 'border-slate-200'}`}>
                  <SaveMap
                    lat={form.lat}
                    lng={form.lng}
                    category={form.category}
                    onMapClick={handleMapClick}
                  />
                </div>
                {errors.coords && <p className="text-xs text-rose-500">{errors.coords}</p>}

                {form.lat != null && form.lng != null ? (
                  <p className="text-xs text-slate-400 text-center">
                    📍 {form.lat.toFixed(5)}, {form.lng.toFixed(5)} · 可再點地圖微調位置
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 text-center">搜尋位置，或直接點擊地圖放 pin</p>
                )}
              </section>

              {/* Notes */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">💬 個人備注</label>
                  <Badge confidence="optional" labels={{ optional: '可選填' }} />
                </div>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2}
                  placeholder="想去的原因、推薦菜式...（選填）"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-300 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 resize-none"
                />
              </section>

              {/* Save button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-slate-800 text-white font-semibold text-base hover:bg-slate-900 transition-colors shadow-lg disabled:opacity-50"
              >
                {saving ? '儲存中...' : '✅ 儲存地點到地圖'}
              </button>

              {form.ig_url && (
                <div className="text-center pb-4">
                  <a
                    href={form.ig_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    查看原始 Instagram 貼文 →
                  </a>
                </div>
              )}
            </form>
          )}

          {/* Idle state */}
          {scrapeStatus === 'idle' && !igUrl && (
            <div className="text-center py-12 text-slate-400">
              <p className="text-5xl mb-4">📸</p>
              <p className="text-slate-600 font-medium">從 Instagram 儲存地點</p>
              <p className="text-sm mt-2">貼入連結，自動填充資訊</p>
            </div>
          )}

        </main>
      </div>
    </>
  );
}
