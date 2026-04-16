import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useTrip } from '../context/TripContext';
import { generateTripId, getJoinedTrips, removeJoinedTrip } from '../lib/tripUtils';

const PRESETS = [
  { label: '🇹🇼 Taiwan',   destination: 'Taipei, Taiwan',  map_lat: 25.0478, map_lng: 121.5319, map_zoom: 13, country_code: 'tw', currency: 'TWD', exchange_rate: 3.85 },
  { label: '🇯🇵 Japan',    destination: 'Tokyo, Japan',    map_lat: 35.6812, map_lng: 139.6503, map_zoom: 13, country_code: 'jp', currency: 'JPY', exchange_rate: 19.5 },
  { label: '🇰🇷 Korea',    destination: 'Seoul, Korea',    map_lat: 37.5665, map_lng: 126.9780, map_zoom: 13, country_code: 'kr', currency: 'KRW', exchange_rate: 175.0 },
  { label: '🇹🇭 Thailand', destination: 'Bangkok, Thailand', map_lat: 13.7563, map_lng: 100.5018, map_zoom: 13, country_code: 'th', currency: 'THB', exchange_rate: 4.5 },
  { label: '🇪🇺 Europe',   destination: 'Paris, France',   map_lat: 48.8566, map_lng: 2.3522,   map_zoom: 13, country_code: 'de', currency: 'EUR', exchange_rate: 0.12 },
  { label: '🇬🇧 UK',       destination: 'London, UK',      map_lat: 51.5074, map_lng: -0.1278,  map_zoom: 13, country_code: 'gb', currency: 'GBP', exchange_rate: 0.10 },
];

const EMPTY_FORM = {
  name: '',
  destination: '',
  map_lat: 25.0478,
  map_lng: 121.5319,
  map_zoom: 13,
  country_code: 'tw',
  currency: 'TWD',
  home_currency: 'HKD',
  exchange_rate: 3.85,
};

export default function TripsPage() {
  const router = useRouter();
  const { tripId, trip, activateTrip, deactivateTrip } = useTrip();
  const [joinedTrips, setJoinedTrips] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    setJoinedTrips(getJoinedTrips());
  }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function applyPreset(preset) {
    setForm((f) => ({
      ...f,
      destination: preset.destination,
      map_lat: preset.map_lat,
      map_lng: preset.map_lng,
      map_zoom: preset.map_zoom,
      country_code: preset.country_code,
      currency: preset.currency,
      exchange_rate: preset.exchange_rate,
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) { showToast('請輸入行程名稱', 'error'); return; }
    if (!supabase) { showToast('需要 Supabase 才能建立行程', 'error'); return; }

    setCreating(true);
    const id = generateTripId();
    const { error: err } = await supabase.from('trips').insert([{
      id,
      name: form.name.trim(),
      destination: form.destination.trim() || form.name.trim(),
      map_lat: form.map_lat,
      map_lng: form.map_lng,
      map_zoom: form.map_zoom,
      country_code: form.country_code,
      currency: form.currency,
      home_currency: form.home_currency,
      exchange_rate: form.exchange_rate,
    }]);

    if (err) {
      setCreating(false);
      showToast(`建立失敗：${err.message}`, 'error');
      return;
    }

    activateTrip(id);
    setCreating(false);
    router.push('/');
  }

  async function handleSwitch(id) {
    activateTrip(id);
    router.push('/');
  }

  function handleForget(id) {
    removeJoinedTrip(id);
    if (tripId === id) deactivateTrip();
    setJoinedTrips(getJoinedTrips());
  }

  async function copyShareLink(id) {
    const url = `${window.location.origin}/join/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showToast('無法複製連結', 'error');
    }
  }

  return (
    <>
      <Head>
        <title>✈️ 行程管理 — Trip Planner</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
          toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="min-h-screen bg-slate-50 font-sans">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-slate-400 hover:text-slate-600 text-sm transition-colors">← 地圖</Link>
              <span className="text-slate-200">|</span>
              <h1 className="font-bold text-slate-800">✈️ 行程管理</h1>
            </div>
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm"
            >
              ＋ 新建行程
            </button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          {/* Create form */}
          {showCreate && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-4">建立新行程</h2>

              {/* Presets */}
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-2 font-medium">快速選擇目的地</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                        form.country_code === p.country_code
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">行程名稱 *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="例：台灣五天四夜"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">目的地</label>
                  <input
                    value={form.destination}
                    onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                    placeholder="例：Taipei, Taiwan"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">目的地貨幣</label>
                    <input
                      value={form.currency}
                      onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                      placeholder="TWD"
                      maxLength={4}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">本地貨幣</label>
                    <input
                      value={form.home_currency}
                      onChange={(e) => setForm((f) => ({ ...f, home_currency: e.target.value.toUpperCase() }))}
                      placeholder="HKD"
                      maxLength={4}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400 uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    匯率（1 {form.home_currency} = ? {form.currency}）
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form.exchange_rate}
                    onChange={(e) => setForm((f) => ({ ...f, exchange_rate: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors disabled:opacity-50"
                  >
                    {creating ? '建立中...' : '建立並進入'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Current trip */}
          {trip && (
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">目前行程</h2>
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-teal-900">{trip.name}</p>
                  <p className="text-sm text-teal-700 mt-0.5">{trip.destination}</p>
                  <p className="text-xs text-teal-600 mt-0.5 font-mono">{trip.id}</p>
                </div>
                <button
                  onClick={() => copyShareLink(trip.id)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-teal-300 bg-white text-teal-700 text-xs font-medium hover:bg-teal-50 transition-colors"
                >
                  {copied === trip.id ? '已複製 ✓' : '🔗 分享'}
                </button>
              </div>
            </section>
          )}

          {/* Joined trips */}
          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">已加入的行程</h2>
            {joinedTrips.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-3xl mb-2">✈️</p>
                <p className="text-sm">還沒有行程，點擊「新建行程」開始吧</p>
              </div>
            ) : (
              <div className="space-y-3">
                {joinedTrips.map((t) => (
                  <div
                    key={t.id}
                    className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-3 ${
                      t.id === tripId ? 'border-teal-300' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{t.name}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{t.destination}</p>
                      <p className="text-xs text-slate-300 font-mono mt-0.5">{t.id}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => copyShareLink(t.id)}
                        className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        {copied === t.id ? '✓' : '🔗'}
                      </button>
                      {t.id !== tripId && (
                        <button
                          onClick={() => handleSwitch(t.id)}
                          className="text-xs text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg font-medium transition-colors border border-teal-200"
                        >
                          切換
                        </button>
                      )}
                      {t.id === tripId && (
                        <span className="text-xs text-teal-600 font-medium px-2 py-1">目前</span>
                      )}
                      <button
                        onClick={() => handleForget(t.id)}
                        className="text-xs text-slate-400 hover:text-rose-500 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* No Supabase notice */}
          {!supabase && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
              <p className="font-medium mb-1">⚠️ 未連接 Supabase</p>
              <p className="text-xs text-amber-700">多行程功能需要 Supabase。目前資料存於本機 localStorage。</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
