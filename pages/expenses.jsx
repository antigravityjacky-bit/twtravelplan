import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useExpenses } from '../hooks/useExpenses';
import ExpenseCard from '../components/ExpenseCard';
import ExpenseForm from '../components/ExpenseForm';

const DEFAULT_MEMBERS = Array(8).fill('');
const DEFAULT_RATE = '3.85';
const DEFAULT_CURRENCY = 'HKD';

// ── Settlement calculation ───────────────────────────────────────────────────
function calculateSettlement(expenses, rate, displayCurrency) {
  const balances = {};

  for (const exp of expenses) {
    const { paid_by, splits = {}, currency } = exp;
    if (!paid_by) continue;

    const factor = currency === displayCurrency ? 1
      : displayCurrency === 'TWD' ? parseFloat(rate)
      : 1 / parseFloat(rate);

    for (const [person, amt] of Object.entries(splits)) {
      if (person === paid_by) continue;
      const converted = parseFloat(amt) * factor;
      if (!isFinite(converted)) continue;
      balances[person] = (balances[person] || 0) - converted;
      balances[paid_by] = (balances[paid_by] || 0) + converted;
    }
  }

  // Separate creditors and debtors; work on copies to allow mutation
  const creditors = Object.entries(balances)
    .filter(([, b]) => b > 0.01)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = Object.entries(balances)
    .filter(([, b]) => b < -0.01)
    .map(([name, amount]) => ({ name, amount: -amount }))
    .sort((a, b) => b.amount - a.amount);

  const transactions = [];
  while (creditors.length > 0 && debtors.length > 0) {
    const c = creditors[0];
    const d = debtors[0];
    const settle = Math.min(c.amount, d.amount);
    transactions.push({ from: d.name, to: c.name, amount: settle });
    c.amount -= settle;
    d.amount -= settle;
    if (c.amount < 0.01) creditors.shift();
    if (d.amount < 0.01) debtors.shift();
  }

  return { transactions, balances };
}

function fmtMoney(n, sym) {
  if (!isFinite(n)) return '—';
  return sym + (Math.round(n * 10) / 10).toFixed(1);
}

export default function ExpensesPage() {
  const { expenses, loading, isSupabase, addExpense, updateExpense, deleteExpense } = useExpenses();

  // ── Persistent state (localStorage) ──────────────────────────────────────
  const [members, setMembersState] = useState(DEFAULT_MEMBERS);
  const [rate, setRateState] = useState(DEFAULT_RATE);
  const [displayCurrency, setDisplayCurrencyState] = useState(DEFAULT_CURRENCY);

  useEffect(() => {
    try {
      const m = localStorage.getItem('tw_trip_members');
      if (m) setMembersState(JSON.parse(m));
      const r = localStorage.getItem('tw_trip_rate');
      if (r) setRateState(r);
      const dc = localStorage.getItem('tw_trip_display_currency');
      if (dc) setDisplayCurrencyState(dc);
    } catch {}
  }, []);

  function setMembers(next) {
    setMembersState(next);
    localStorage.setItem('tw_trip_members', JSON.stringify(next));
  }
  function setRate(v) {
    setRateState(v);
    localStorage.setItem('tw_trip_rate', v);
  }
  function toggleCurrency() {
    const next = displayCurrency === 'HKD' ? 'TWD' : 'HKD';
    setDisplayCurrencyState(next);
    localStorage.setItem('tw_trip_display_currency', next);
  }

  // ── UI state ──────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // id to confirm

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const activeMembers = members.filter((m) => m.trim());
  const sym = displayCurrency === 'HKD' ? 'HK$' : 'NT$';
  const rateNum = parseFloat(rate) || 3.85;

  // ── Settlement ────────────────────────────────────────────────────────────
  const { transactions, balances } = useMemo(
    () => calculateSettlement(expenses, rateNum, displayCurrency),
    [expenses, rateNum, displayCurrency]
  );

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let hkd = 0, twd = 0;
    for (const e of expenses) {
      if (e.currency === 'HKD') { hkd += parseFloat(e.amount) || 0; twd += (parseFloat(e.amount) || 0) * rateNum; }
      else { twd += parseFloat(e.amount) || 0; hkd += (parseFloat(e.amount) || 0) / rateNum; }
    }
    return { hkd, twd };
  }, [expenses, rateNum]);

  // ── Form handlers ─────────────────────────────────────────────────────────
  function openAdd()   { setEditing(null); setFormOpen(true); }
  function openEdit(e) { setEditing(e);    setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); }

  async function handleSave(data) {
    setSaving(true);
    const result = editing
      ? await updateExpense({ ...data, id: editing.id })
      : await addExpense(data);
    setSaving(false);
    if (result.error) { showToast(`錯誤：${result.error}`, 'error'); return; }
    showToast(editing ? '已儲存更改 ✓' : '已新增費用 ✓');
    closeForm();
  }

  async function handleDelete(id) {
    const result = await deleteExpense(id);
    if (result.error) showToast(`刪除失敗：${result.error}`, 'error');
    else showToast('已刪除 ✓');
    setDeleteConfirm(null);
  }

  return (
    <>
      <Head>
        <title>💸 帳單分攤 — Taiwan Trip</title>
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

      {/* Delete confirm dialog */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <p className="text-slate-700 font-medium mb-4">確定刪除這筆費用？</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium">取消</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold">刪除</button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/" className="text-slate-400 hover:text-slate-600 text-sm flex-shrink-0">← 地圖</Link>
              <span className="text-slate-200">|</span>
              <h1 className="font-bold text-slate-800 truncate">💸 帳單分攤</h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <nav className="hidden sm:flex items-center gap-1 text-xs">
                <Link href="/itinerary"  className="text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100">📅 行程</Link>
                <Link href="/accommodations" className="text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100">🏨 住宿</Link>
                <Link href="/save"       className="text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100">📸 IG</Link>
                <Link href="/admin"      className="text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100">✏️ 管理</Link>
              </nav>
              {/* Currency toggle */}
              <button
                onClick={toggleCurrency}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold hover:bg-teal-100 transition-colors"
              >
                {displayCurrency === 'HKD' ? 'HK$' : 'NT$'}
                <span className="text-teal-400">⇄</span>
                {displayCurrency === 'HKD' ? 'NT$' : 'HK$'}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

          {/* ── Exchange rate + sync status bar ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500 flex-shrink-0">匯率 1 HKD =</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm text-center outline-none focus:border-teal-400"
            />
            <span className="text-xs text-slate-500">TWD</span>
            <span className="ml-auto text-xs text-slate-400">
              {isSupabase ? '☁️ 即時同步' : '💾 本機儲存'}
            </span>
          </div>

          {/* ── Members config ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setMembersOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span>👥 成員設定（{activeMembers.length}/8）</span>
              <span className="text-slate-400">{membersOpen ? '▲' : '▼'}</span>
            </button>
            {membersOpen && (
              <div className="px-4 pb-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                {members.map((name, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-4 flex-shrink-0">{i + 1}</span>
                    <input
                      value={name}
                      onChange={(e) => {
                        const next = [...members];
                        next[i] = e.target.value;
                        setMembers(next);
                      }}
                      placeholder={`成員 ${i + 1}`}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-teal-400"
                    />
                  </div>
                ))}
                <p className="col-span-2 text-xs text-slate-400 mt-1">
                  名字儲存在此裝置。其他裝置需輸入相同名字。
                </p>
              </div>
            )}
          </div>

          {/* ── Summary totals ── */}
          {expenses.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-teal-50 border border-teal-100 rounded-2xl px-4 py-3 text-center">
                <p className="text-xs text-teal-600 mb-1">總費用（{displayCurrency}）</p>
                <p className="text-xl font-bold text-teal-700">
                  {sym}{(displayCurrency === 'HKD' ? totals.hkd : totals.twd).toFixed(0)}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-center">
                <p className="text-xs text-slate-500 mb-1">筆數</p>
                <p className="text-xl font-bold text-slate-700">{expenses.length}</p>
              </div>
            </div>
          )}

          {/* ── Expense list + Add button ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">費用記錄</h2>
              <button
                onClick={openAdd}
                disabled={activeMembers.length === 0}
                title={activeMembers.length === 0 ? '請先設定成員' : undefined}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-40"
              >
                ＋ 新增費用
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-7 h-7 border-2 border-slate-300 border-t-teal-600 rounded-full animate-spin" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-3">💸</p>
                <p className="text-slate-600 font-medium">還沒有費用記錄</p>
                {activeMembers.length === 0 ? (
                  <p className="text-sm mt-1.5">請先點「成員設定」填入 8 位成員名字</p>
                ) : (
                  <p className="text-sm mt-1.5">點「＋ 新增費用」開始記帳</p>
                )}
              </div>
            ) : (
              expenses.map((e) => (
                <ExpenseCard
                  key={e.id}
                  expense={e}
                  displayCurrency={displayCurrency}
                  rate={rateNum}
                  onEdit={openEdit}
                  onDelete={(id) => setDeleteConfirm(id)}
                />
              ))
            )}
          </div>

          {/* ── Settlement ── */}
          {expenses.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">💰 結算摘要</h2>
                <span className="text-xs text-slate-400">顯示 {displayCurrency}</span>
              </div>

              {/* Per-person balance */}
              {Object.keys(balances).length > 0 && (
                <div className="px-4 py-3 space-y-2 border-b border-slate-100">
                  <p className="text-xs font-medium text-slate-500">個人餘額</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(balances)
                      .filter(([, b]) => Math.abs(b) > 0.01)
                      .sort(([, a], [, b]) => b - a)
                      .map(([name, bal]) => (
                        <div
                          key={name}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium ${
                            bal > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          <span>{name}</span>
                          <span>{bal > 0 ? '+' : ''}{fmtMoney(bal, sym)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Transaction list */}
              <div className="px-4 py-3">
                {transactions.length === 0 ? (
                  <p className="text-sm text-emerald-600 font-medium text-center py-2">✅ 已全部結清！</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500">最少交易</p>
                    {transactions.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        <span className="text-sm font-semibold text-rose-600 flex-1">{t.from}</span>
                        <span className="text-slate-400 text-xs">→ 付</span>
                        <span className="text-sm font-semibold text-emerald-600 flex-1 text-right">{t.to}</span>
                        <span className="ml-3 text-sm font-bold text-slate-800 flex-shrink-0">
                          {fmtMoney(t.amount, sym)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pb-6" />
        </main>
      </div>

      {/* Expense form modal */}
      {formOpen && (
        <ExpenseForm
          initial={editing}
          members={activeMembers}
          onSave={handleSave}
          onCancel={closeForm}
          saving={saving}
        />
      )}
    </>
  );
}
