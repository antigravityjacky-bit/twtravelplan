import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { usePlaces } from '../hooks/usePlaces';
import { parseCaption } from '../lib/parser';
import { geocodeAddress } from '../lib/geocode';
import { parseMapsCoords, parseMapsPlaceName, isGoogleMapsUrl } from '../lib/parseMapsUrl';

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
  name: '', nameEn: '', category: 'Attraction', address: '',
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
  const [geocoding, setGeocoding] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [isStandalone, setIsStandalone] = useState(null);
  const [clipboardPrompt, setClipboardPrompt] = useState(null); // { url } | null
  const [mapsUrl, setMapsUrl] = useState('');
  const [mapsImporting, setMapsImporting] = useState(false);
  const hasAutoFetched = useRef(false);

  // Detect standalone mode + auto-read clipboard when opened as PWA
  useEffect(() => {
    const standalone = !!window.navigator.standalone;
    setIsStandalone(standalone);

    if (!standalone) return;
    // In PWA mode: try to read clipboard for an IG link (no query params means
    // user opened the app manually, not via Web Share Target)
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

  // ── Extract URL from router.query (Web Share Target or manual) ───────────
  useEffect(() => {
    if (!router.isReady) return;
    const { url, text, title } = router.query;

    // Web Share Target passes url= or text= (Instagram link)
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
      // Step 1: Scrape Open Graph data
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
      const og = await res.json();

      // Step 2: Parse caption
      const parsed = parseCaption(og.description || '');

      // Step 3: Fill form fields
      if (og.image) {
        newForm.image_url = og.image;
        newConf.image = 'high';
      } else {
        newConf.image = 'none';
      }

      if (parsed.name) {
        newForm.name = parsed.name;
        newConf.name = parsed.nameConfidence;
      } else {
        newConf.name = 'none';
      }

      if (parsed.description) {
        newForm.description = parsed.description.slice(0, 300);
        newConf.description = 'low';
      } else {
        newConf.description = 'none';
      }

      newForm.category = parsed.category;
      newConf.category = parsed.categoryConfidence;

      // Coords intentionally not auto-filled — use Google Maps flow for accuracy
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
      // User denied permission or API unavailable — fall back to manual paste
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
  }

  async function handleGeocode() {
    const query = [form.name.trim(), form.address.trim()].filter(Boolean).join(' ');
    if (!query) return;
    setGeocoding(true);
    const coords = await geocodeAddress(query);
    setGeocoding(false);
    if (coords) {
      setForm((f) => ({ ...f, lat: coords.lat, lng: coords.lng }));
      setConfidence((c) => ({ ...c, coords: 'low' }));
      setErrors((e) => ({ ...e, coords: undefined }));
    } else {
      showToast('找不到位置，試試加上「台灣」或更完整地址', 'error');
    }
  }

  async function handleMapsImport() {
    const url = mapsUrl.trim();
    if (!url) return;
    setMapsImporting(true);

    // Try to parse coordinates directly from the URL string
    const direct = parseMapsCoords(url);
    if (direct) {
      applyMapsResult(direct, url);
      setMapsImporting(false);
      return;
    }

    // Short URL or URL without coords — resolve server-side
    if (isGoogleMapsUrl(url)) {
      try {
        const res = await fetch(`/api/resolve-maps?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.lat) {
          applyMapsResult({ lat: data.lat, lng: data.lng }, data.resolvedUrl || url);
        } else {
          showToast('無法解析，請複製 Google Maps 網址列的完整連結試試', 'error');
        }
      } catch {
        showToast('解析失敗，請稍後再試', 'error');
      }
    } else {
      showToast('請貼入 Google Maps 連結（含 google.com/maps 或 maps.app.goo.gl）', 'error');
    }

    setMapsImporting(false);
  }

  function applyMapsResult({ lat, lng }, sourceUrl) {
    setForm((f) => {
      // Also try to fill address from the URL place name if address is still empty
      const fromUrl = parseMapsPlaceName(sourceUrl);
      return {
        ...f,
        lat,
        lng,
        address: f.address || fromUrl || f.address,
      };
    });
    setConfidence((c) => ({ ...c, coords: 'high' }));
    setErrors((e) => ({ ...e, coords: undefined }));
    setMapsUrl('');
    showToast('✅ Google Maps 位置已套用');
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = '必填';
    if (form.lat == null || form.lng == null) e.coords = '請點選地圖或填入座標';
    return e;
  }

  async function handleSave(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);

    const base = {
      name:        form.name.trim(),
      nameEn:      form.nameEn.trim(),
      category:    form.category,
      address:     form.address.trim(),
      description: form.description.trim(),
      lat:         form.lat,
      lng:         form.lng,
    };

    // Try with new columns first; if they don't exist yet, fall back to base fields
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

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* ── Step 1: URL Input ── */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="text-xl">📱</span>
              Instagram 連結
            </h2>

            {/* Clipboard prompt — shown in standalone (PWA) mode when IG link detected */}
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

            {/* Standalone mode detector — shown only in browser (not installed PWA) */}
            {isStandalone === false && scrapeStatus === 'idle' && !igUrl && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                <p className="font-semibold mb-1">⚠️ 正在 Safari 瀏覽器開啟（非 App 模式）</p>
                <p className="mb-1.5">最可靠方法 👇 複製連結 → 回來按「貼上」按鈕，不需要安裝。</p>
                <details>
                  <summary className="cursor-pointer text-amber-700 font-medium">想從 IG 分享直接打開？（需安裝）</summary>
                  <ol className="list-decimal list-inside space-y-0.5 mt-1.5">
                    <li>用 <strong>Safari</strong> 打開此網站</li>
                    <li>底部 □↑ 分享鍵 → 向下滑找「<strong>加入主畫面</strong>」（不是「加入書籤」）</li>
                    <li>從主畫面圖示開啟一次</li>
                    <li>Instagram → 分享 → 更多 → 找「TW Trip」啟用</li>
                    <li>⚠️ iOS 並非所有版本都支援，若看不到屬正常</li>
                  </ol>
                </details>
              </div>
            )}

            {/* iOS instruction hint */}
            {!igUrl && scrapeStatus === 'idle' && !clipboardPrompt && (
              <div className="mb-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 leading-relaxed">
                <p className="font-semibold mb-1">📱 使用方法</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Instagram Reel → 右下「分享」→「複製連結」</li>
                  <li>回到這裡 → 按「📋 貼上 IG 連結」</li>
                </ol>
                {isStandalone && (
                  <p className="mt-1.5 text-emerald-600 font-medium">✅ App 模式：下次複製連結後開啟 app 會自動偵測</p>
                )}
              </div>
            )}

            {/* Clipboard paste button — primary iOS flow */}
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

            {/* Loading indicator */}
            {isLoading && (
              <div className="mt-4 flex items-center gap-3 text-sm text-slate-500">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin flex-shrink-0" />
                <span>正在抓取圖片和資訊，約 2–5 秒...</span>
              </div>
            )}
          </section>

          {/* ── Form (shown after scrape attempt or when URL is present) ── */}
          {(scrapeStatus === 'done' || scrapeStatus === 'error') && (
            <form onSubmit={handleSave} className="space-y-5">

              {/* Image preview */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">📸 圖片</h2>
                  <Badge confidence={confidence.image ?? 'none'} labels={{ high: '自動抓取', none: '未找到圖片' }} />
                </div>
                {form.image_url && !imgError ? (
                  <img
                    src={form.image_url}
                    alt="Instagram post"
                    className="w-full max-h-72 object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="mx-5 mb-4 h-32 bg-slate-100 rounded-xl flex items-center justify-center">
                    <span className="text-4xl opacity-30">📷</span>
                  </div>
                )}
                {/* Image URL override */}
                <div className="px-5 pb-4">
                  <input
                    value={form.image_url}
                    onChange={(e) => { set('image_url', e.target.value); setImgError(false); }}
                    placeholder="圖片 URL（可手動修改）"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400 text-slate-600 placeholder-slate-300"
                  />
                </div>
              </section>

              {/* Name */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">📍 地點名稱 *</label>
                  <Badge confidence={confidence.name ?? 'none'} labels={{ low: '請確認', none: '請手動填寫' }} />
                </div>
                <input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="例：阜杭豆漿"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-300 outline-none transition-all ${
                    errors.name ? 'border-rose-300 focus:ring-2 focus:ring-rose-100' : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
                  }`}
                />
                {errors.name && <p className="text-xs text-rose-500">{errors.name}</p>}

                <input
                  value={form.nameEn}
                  onChange={(e) => set('nameEn', e.target.value)}
                  placeholder="English name（選填）"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-300 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </section>

              {/* Category */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
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
              </section>

              {/* Description */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
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
              </section>

              {/* Location + Map */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">🗺️ 位置</label>
                  <Badge
                    confidence={confidence.coords ?? 'none'}
                    labels={{ low: '自動定位（請確認）', manual: '手動選擇', none: '請在地圖點選' }}
                  />
                </div>

                {/* Address input + geocode button */}
                <div className="flex gap-2">
                  <input
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGeocode(); } }}
                    placeholder="輸入地址或地點名稱，按🔍自動定位"
                    className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-300 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleGeocode}
                    disabled={geocoding || (!form.address.trim() && !form.name.trim())}
                    className="px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40 flex-shrink-0 flex items-center gap-1.5"
                  >
                    {geocoding
                      ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : '🔍'}
                    {geocoding ? '搜尋中' : '定位'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 -mt-1">輸入地名 → 按定位；或用下方 Google Maps 確認更準確位置</p>

                {/* ── Google Maps verification flow ── */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2.5">
                  <p className="text-xs font-semibold text-slate-700">🗺️ 用 Google Maps 確認準確位置（推薦）</p>

                  {/* Step 1 — open Google Maps */}
                  <a
                    href={
                      form.name.trim()
                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.name.trim() + (form.address.trim() ? ' ' + form.address.trim() : '') + ' Taiwan')}`
                        : undefined
                    }
                    onClick={(e) => { if (!form.name.trim()) e.preventDefault(); }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      form.name.trim()
                        ? 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    🗺️ {form.name.trim() ? `搜尋「${form.name.trim()}」in Google Maps` : '先填入地點名稱'}
                  </a>

                  {/* Step 2 — paste Google Maps share link */}
                  <div className="space-y-1.5">
                    <p className="text-xs text-slate-500">
                      找到後：Google Maps → 右上 ⋯ → <strong>分享</strong> → <strong>複製連結</strong> → 貼在這裡 ↓
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={mapsUrl}
                        onChange={(e) => setMapsUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMapsImport(); } }}
                        placeholder="貼入 Google Maps 連結..."
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 placeholder-slate-300 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-50"
                      />
                      <button
                        type="button"
                        onClick={handleMapsImport}
                        disabled={!mapsUrl.trim() || mapsImporting}
                        className="px-3.5 py-2 bg-green-500 text-white text-xs font-semibold rounded-xl hover:bg-green-600 disabled:opacity-40 flex-shrink-0 flex items-center gap-1"
                      >
                        {mapsImporting
                          ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : '✓'}
                        {mapsImporting ? '解析中' : '套用'}
                      </button>
                    </div>
                  </div>

                  {confidence.coords === 'high' && (
                    <p className="text-xs text-green-600 font-medium">✅ Google Maps 位置已確認</p>
                  )}
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
                  <p className="text-xs text-slate-400 text-center">輸入地名按定位，或直接點擊地圖放 pin</p>
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
                  placeholder="想去的原因、推薦菜式... （選填）"
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

              {/* IG URL display */}
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

          {/* Idle state — instructions */}
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
