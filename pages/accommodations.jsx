import { useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAccommodations } from '../hooks/useAccommodations';
import AccommodationCard from '../components/AccommodationCard';
import AccommodationForm from '../components/AccommodationForm';

const TYPES = ['All', 'Hotel', 'Airbnb', 'Hostel', 'Other'];

export default function Accommodations() {
  const { accommodations, loading, isSupabase, addAccommodation, updateAccommodation, deleteAccommodation } =
    useAccommodations();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeType, setActiveType] = useState('All');

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function openAdd()  { setEditing(null); setFormOpen(true); }
  function openEdit(a) { setEditing(a); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); }

  async function handleSave(data) {
    setSaving(true);
    const op = editing
      ? updateAccommodation({ ...data, id: editing.id })
      : addAccommodation(data);
    const { error: err } = await op;
    setSaving(false);
    if (err) { showToast(`錯誤：${err}`, 'error'); return; }
    showToast(editing ? '已儲存更改 ✓' : '已新增住宿 ✓');
    closeForm();
  }

  async function handleDelete(id) {
    const { error: err } = await deleteAccommodation(id);
    if (err) showToast(`刪除失敗：${err}`, 'error');
    else showToast('已刪除住宿 ✓');
  }

  const filtered = useMemo(() => {
    if (activeType === 'All') return accommodations;
    return accommodations.filter((a) => a.type === activeType);
  }, [accommodations, activeType]);

  const counts = useMemo(() => {
    const c = { All: accommodations.length };
    TYPES.slice(1).forEach((t) => {
      c[t] = accommodations.filter((a) => a.type === t).length;
    });
    return c;
  }, [accommodations]);

  return (
    <>
      <Head>
        <title>🏨 住宿選項 — Taiwan Trip</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
          toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="min-h-screen bg-slate-50 font-sans">
        {/* Sticky header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
              <Link href="/" className="text-slate-400 hover:text-slate-600 transition-colors text-sm flex-shrink-0">
                🗺️ 地圖
              </Link>
              <span className="text-slate-200 flex-shrink-0">|</span>
              <Link href="/itinerary" className="text-slate-400 hover:text-slate-600 transition-colors text-sm flex-shrink-0">
                📅 行程
              </Link>
              <span className="text-slate-200 flex-shrink-0">|</span>
              <span className="font-bold text-slate-800 flex-shrink-0">🏨 住宿</span>
              <span className="text-slate-200 flex-shrink-0">|</span>
              <Link href="/save" className="text-slate-400 hover:text-slate-600 transition-colors text-sm flex-shrink-0">📸 IG</Link>
              <span className="text-slate-200 flex-shrink-0">|</span>
              <Link href="/admin" className="text-slate-400 hover:text-slate-600 transition-colors text-sm flex-shrink-0">
                ✏️ 管理
              </Link>
            </div>
            <button
              onClick={openAdd}
              className="flex-shrink-0 px-4 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm"
            >
              ＋ 新增住宿
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {/* Page title + meta */}
          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">🏨 住宿選項</h1>
              <p className="text-sm text-slate-400 mt-1">
                {loading ? '載入中...' : `${accommodations.length} 個選項`}
                {isSupabase && (
                  <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    Real-time 同步
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Type filter */}
          <div className="flex gap-2 flex-wrap mb-6">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  activeType === t
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
              >
                {t}
                {counts[t] > 0 && (
                  <span className={`ml-1.5 text-xs ${activeType === t ? 'text-slate-300' : 'text-slate-400'}`}>
                    {counts[t]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-4xl mb-3 animate-pulse">🏨</p>
              <p className="text-slate-400">載入中...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-4xl mb-3">🏨</p>
              <p className="text-slate-700 font-medium mb-1">
                {activeType === 'All' ? '還沒有住宿選項' : `沒有 ${activeType} 選項`}
              </p>
              <p className="text-slate-400 text-sm mb-5">點擊「＋ 新增住宿」開始添加</p>
              <button
                onClick={openAdd}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm"
              >
                ＋ 新增第一個住宿
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((a) => (
                <AccommodationCard
                  key={a.id}
                  accommodation={a}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </main>

        {/* Mobile FAB */}
        <button
          onClick={openAdd}
          className="fixed bottom-6 right-6 z-30 sm:hidden w-14 h-14 rounded-full bg-slate-800 text-white text-2xl shadow-xl flex items-center justify-center hover:bg-slate-900 transition-colors"
          aria-label="新增住宿"
        >
          ＋
        </button>
      </div>

      {formOpen && (
        <AccommodationForm
          initial={editing}
          onSave={handleSave}
          onCancel={closeForm}
          saving={saving}
        />
      )}
    </>
  );
}
