import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { usePlaces } from '../hooks/usePlaces';
import { parseCaption } from '../lib/parser';
import { geocodeAddress } from '../lib/geocode';

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
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const hasAutoFetched = useRef(false);

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

      // Step 4: Geocode if we have a location hint
      const searchQuery = [parsed.name, parsed.location].filter(Boolean).join(' ');
      if (searchQuery) {
        const coords = await geocodeAddress(searchQuery);
        if (coords) {
          newForm.lat = coords.lat;
          newForm.lng = coords.lng;
          newForm.address = parsed.location || '';
          newConf.coords = 'low';
        } else {
          newConf.coords = 'none';
        }
      } else {
        newConf.coords = 'none';
      }

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
    const { error: err } = await addPlace({
      name:        form.name.trim(),
      nameEn:      form.nameEn.trim(),
      category:    form.category,
      address:     form.address.trim(),
      description: form.description.trim(),
      lat:         form.lat,
      lng:         form.lng,
      image_url:   form.image_url.trim(),
      ig_url:      form.ig_url.trim(),
    });
    setSaving(false);

    if (err) {
      showToast(`儲存失敗：${err}`, 'error');
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

            {/* iOS instruction hint */}
            {!igUrl && scrapeStatus === 'idle' && (
              <div className="mb-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 leading-relaxed">
                <p className="font-semibold mb-1.5">📱 最快方法：複製連結 → 貼上</p>
                <ol className="list-decimal list-inside space-y-0.5 mb-2">
                  <li>Instagram Reel → 右下角「分享」→「複製連結」</li>
                  <li>回到這裡，按下方「📋 貼上 IG 連結」</li>
                </ol>
                <details className="mt-1">
                  <summary className="cursor-pointer text-blue-500 font-medium">⚙️ 想用 iOS 分享按鈕自動開啟？</summary>
                  <ol className="list-decimal list-inside space-y-0.5 mt-1.5">
                    <li>用 <strong>Safari</strong> 打開這個網站</li>
                    <li>底部分享 → 「加入主畫面」安裝</li>
                    <li><strong>從主畫面開啟一次 app</strong>（必須！）</li>
                    <li>Instagram → 分享 → 向左滑到「更多」→ 啟用「TW Trip」</li>
                  </ol>
                </details>
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
                    labels={{ low: '自動定位（請確認）', manual: '手動選擇', none: '請點選地圖' }}
                  />
                </div>

                <input
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="地址或區域（選填）"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-300 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />

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
                    📍 {form.lat.toFixed(5)}, {form.lng.toFixed(5)} · 可再點地圖調整位置
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 text-center">點擊地圖放置地點 pin</p>
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
