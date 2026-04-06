import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { usePlaces } from '../hooks/usePlaces';
import PlaceForm from '../components/PlaceForm';
import { CATEGORY_BADGE, CATEGORY_BORDER } from '../components/FilterBar';

const CATEGORY_EMOJI = {
  Breakfast:  '🍳',
  Cafe:       '☕',
  Restaurant: '🍽️',
  Attraction: '🗺️',
  Hotel:      '🏨',
  Bar:        '🍸',
  Food:       '🍜', // backward-compat
};

const CATEGORY_LABEL = {
  Breakfast:  '早餐店',
  Cafe:       '咖啡店',
  Restaurant: '餐廳',
  Attraction: 'Attraction',
  Hotel:      'Hotel',
  Bar:        'Bar',
  Food:       'Food',
};

const STAT_CATEGORIES = ['Breakfast', 'Cafe', 'Restaurant', 'Attraction', 'Hotel', 'Bar'];

export default function Admin() {
  const {
    places, loading, error, isSupabase,
    addPlace, updatePlace, deletePlace,
  } = usePlaces();

  const [formOpen, setFormOpen]           = useState(false);
  const [editing, setEditing]             = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch]               = useState('');
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function openAdd()       { setEditing(null); setFormOpen(true); }
  function openEdit(place) { setEditing(place); setFormOpen(true); }
  function closeForm()     { setFormOpen(false); setEditing(null); }

  async function handleSave(data) {
    setSaving(true);
    const op = editing
      ? updatePlace({ ...data, id: editing.id })
      : addPlace(data);
    const { error: err } = await op;
    setSaving(false);
    if (err) { showToast(`錯誤：${err}`, 'error'); return; }
    showToast(editing ? '已儲存更改 ✓' : '已新增地點 ✓');
    closeForm();
  }

  async function confirmDoDelete() {
    setSaving(true);
    const { error: err } = await deletePlace(confirmDelete.id);
    setSaving(false);
    setConfirmDelete(null);
    if (err) { showToast(`刪除失敗：${err}`, 'error'); return; }
    showToast('已刪除地點 ✓');
  }

  const filtered = places.filter((p) =>
    !search.trim() ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.nameEn ?? '').toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Head><title>Admin — Taiwan Trip Planner</title></Head>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
          toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="min-h-screen bg-slate-50">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-slate-400 hover:text-slate-600 transition-colors text-sm">
                ← 返回地圖
              </Link>
              <span className="text-slate-200">|</span>
              <h1 className="font-bold text-slate-800">🇹🇼 行程管理</h1>
              {isSupabase && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  Real-time 同步
                </span>
              )}
            </div>
            <button
              onClick={openAdd}
              className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm"
            >
              + 新增地點
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-8">
          {/* Error banner */}
          {error && (
            <div className="mb-6 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
              <span>⚠️</span><span>{error}</span>
              <button onClick={() => window.location.reload()} className="ml-auto underline text-xs">重試</button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
            {STAT_CATEGORIES.map((cat) => {
              const count = places.filter((p) => p.category === cat).length;
              return (
                <div key={cat} className={`bg-white rounded-2xl p-3 border-l-4 shadow-sm ${CATEGORY_BORDER[cat]}`}>
                  <p className="text-2xl font-bold text-slate-800">{loading ? '–' : count}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                    {CATEGORY_EMOJI[cat]} {CATEGORY_LABEL[cat]}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Search + count */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-white"
                placeholder="搜尋地點..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <p className="text-sm text-slate-400">
              共 <span className="font-semibold text-slate-700">{loading ? '…' : filtered.length}</span> 個地點
            </p>
          </div>

          {/* Table */}
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-slate-400">
              <p className="text-3xl mb-2 animate-pulse">🗺️</p>
              <p>載入中...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-3xl mb-2">🗺️</p>
              <p>沒有符合條件的地點</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">名稱</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">分類</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">地址</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">座標</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((place) => (
                    <tr key={place.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{place.name}</p>
                        {place.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{place.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ring-1 ${CATEGORY_BADGE[place.category] ?? CATEGORY_BADGE.Food}`}>
                          {CATEGORY_EMOJI[place.category] ?? '📍'} {CATEGORY_LABEL[place.category] ?? place.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell max-w-[200px]">
                        <p className="truncate">{place.address}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs hidden sm:table-cell whitespace-nowrap">
                        {place.lat != null ? `${place.lat}, ${place.lng}` : '–'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(place)} className="px-2.5 py-1 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition-colors">編輯</button>
                          <button onClick={() => setConfirmDelete(place)} className="px-2.5 py-1 rounded-lg text-xs text-rose-500 hover:bg-rose-50 transition-colors">刪除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {formOpen && (
        <PlaceForm initial={editing} onSave={handleSave} onCancel={closeForm} saving={saving} />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <p className="font-semibold text-slate-800">確定刪除？</p>
            <p className="text-sm text-slate-500 mt-1">「{confirmDelete.name}」刪除後不可恢復。</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmDelete(null)} disabled={saving} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors disabled:opacity-50">取消</button>
              <button onClick={confirmDoDelete} disabled={saving} className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-50">
                {saving ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
