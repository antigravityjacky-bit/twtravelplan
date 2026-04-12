import { useState, useEffect, useCallback } from 'react';

const SPLIT_MODES = [
  { value: 'equal',      label: '均分' },
  { value: 'percentage', label: '百分比 %' },
  { value: 'manual',     label: '手動輸入' },
];

const EMPTY = {
  title: '',
  amount: '',
  currency: 'HKD',
  paidBy: '',
  participants: [],
  splitMode: 'equal',
  notes: '',
};

function fmt(n) { return isFinite(n) ? n.toFixed(2) : '—'; }

export default function ExpenseForm({ initial, members, onSave, onCancel, saving = false }) {
  const [form, setForm] = useState(EMPTY);
  const [inputSplits, setInputSplits] = useState({}); // % strings or amount strings per person
  const [errors, setErrors] = useState({});

  const activeMembers = members.filter((m) => m.trim());

  // Initialise / reset form when opened
  useEffect(() => {
    if (initial) {
      // Editing: reconstruct inputSplits from stored splits
      const mode = initial.split_mode || 'equal';
      const storedSplits = initial.splits || {};
      const participants = initial.participants || Object.keys(storedSplits);
      const amt = parseFloat(initial.amount) || 0;

      let inputs = {};
      if (mode === 'percentage') {
        Object.entries(storedSplits).forEach(([name, val]) => {
          inputs[name] = amt > 0 ? fmt((parseFloat(val) / amt) * 100) : '0';
        });
      } else if (mode === 'manual') {
        Object.entries(storedSplits).forEach(([name, val]) => {
          inputs[name] = fmt(parseFloat(val));
        });
      }

      setForm({
        title:       initial.title || '',
        amount:      String(initial.amount || ''),
        currency:    initial.currency || 'HKD',
        paidBy:      initial.paid_by || '',
        participants,
        splitMode:   mode,
        notes:       initial.notes || '',
      });
      setInputSplits(inputs);
    } else {
      // New expense: default to all active members
      setForm({ ...EMPTY, participants: [...activeMembers] });
      setInputSplits({});
    }
    setErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // When participants or splitMode or amount change, redistribute inputSplits
  const redistributeSplits = useCallback((participants, splitMode, amtStr) => {
    const n = participants.length;
    if (n === 0) { setInputSplits({}); return; }
    const amt = parseFloat(amtStr) || 0;

    if (splitMode === 'percentage') {
      const each = fmt(100 / n);
      const inputs = {};
      participants.forEach((p, i) => {
        // Last person gets the remainder to avoid rounding errors
        inputs[p] = i === n - 1
          ? fmt(100 - (n - 1) * (100 / n))
          : each;
      });
      setInputSplits(inputs);
    } else if (splitMode === 'manual') {
      const each = fmt(amt / n);
      const inputs = {};
      participants.forEach((p, i) => {
        inputs[p] = i === n - 1 ? fmt(amt - (n - 1) * (amt / n)) : each;
      });
      setInputSplits(inputs);
    }
  }, []);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleSplitModeChange(mode) {
    setField('splitMode', mode);
    redistributeSplits(form.participants, mode, form.amount);
  }

  function handleAmountChange(val) {
    setField('amount', val);
    if (form.splitMode !== 'equal') {
      redistributeSplits(form.participants, form.splitMode, val);
    }
  }

  function handleParticipantToggle(name) {
    setForm((f) => {
      const next = f.participants.includes(name)
        ? f.participants.filter((p) => p !== name)
        : [...f.participants, name];
      redistributeSplits(next, f.splitMode, f.amount);
      return { ...f, participants: next };
    });
    setErrors((e) => ({ ...e, participants: undefined }));
  }

  function handlePaidByChange(name) {
    setField('paidBy', name);
    // Ensure payer is in participants
    if (!form.participants.includes(name)) {
      setForm((f) => {
        const next = [...f.participants, name];
        redistributeSplits(next, f.splitMode, f.amount);
        return { ...f, paidBy: name, participants: next };
      });
    }
  }

  function setInputSplit(name, val) {
    setInputSplits((s) => ({ ...s, [name]: val }));
    setErrors((e) => ({ ...e, splits: undefined }));
  }

  // Compute final split amounts per person
  function getCalculatedSplits() {
    const { participants, splitMode, amount } = form;
    const amt = parseFloat(amount) || 0;
    const n = participants.length;
    if (n === 0) return {};

    const result = {};
    if (splitMode === 'equal') {
      participants.forEach((p, i) => {
        result[p] = i === n - 1
          ? parseFloat((amt - (n - 1) * (amt / n)).toFixed(2))
          : parseFloat((amt / n).toFixed(2));
      });
    } else if (splitMode === 'percentage') {
      participants.forEach((p) => {
        const pct = parseFloat(inputSplits[p]) || 0;
        result[p] = parseFloat(((pct / 100) * amt).toFixed(2));
      });
    } else {
      participants.forEach((p) => {
        result[p] = parseFloat(parseFloat(inputSplits[p] || '0').toFixed(2));
      });
    }
    return result;
  }

  function getSplitTotal(calcSplits) {
    return Object.values(calcSplits).reduce((s, v) => s + v, 0);
  }

  function validate() {
    const e = {};
    const amt = parseFloat(form.amount);
    if (!form.title.trim()) e.title = '必填';
    if (!form.amount || isNaN(amt) || amt <= 0) e.amount = '請輸入正數金額';
    if (!form.paidBy) e.paidBy = '請選擇付款人';
    if (form.participants.length === 0) e.participants = '至少選擇 1 位成員';

    if (form.splitMode !== 'equal' && form.participants.length > 0) {
      const calc = getCalculatedSplits();
      const total = getSplitTotal(calc);
      const diff = Math.abs(total - amt);
      if (form.splitMode === 'percentage') {
        const pctSum = form.participants.reduce(
          (s, p) => s + (parseFloat(inputSplits[p]) || 0), 0
        );
        if (Math.abs(pctSum - 100) > 0.5) e.splits = `百分比合計須為 100%（目前 ${pctSum.toFixed(1)}%）`;
      } else if (diff > 0.5) {
        e.splits = `各人合計 ${total.toFixed(2)} 與總金額 ${amt.toFixed(2)} 不符`;
      }
    }
    return e;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const calcSplits = getCalculatedSplits();
    onSave({
      title:       form.title.trim(),
      amount:      parseFloat(form.amount),
      currency:    form.currency,
      paid_by:     form.paidBy,
      participants: form.participants,
      splits:      calcSplits,
      split_mode:  form.splitMode,
      notes:       form.notes.trim(),
    });
  }

  const amt = parseFloat(form.amount) || 0;
  const calcSplits = getCalculatedSplits();
  const splitTotal = getSplitTotal(calcSplits);
  const currSym = form.currency === 'HKD' ? 'HK$' : 'NT$';
  const isEdit = !!initial;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-3xl sm:rounded-t-3xl">
          <h2 className="text-base font-bold text-slate-800">{isEdit ? '編輯費用' : '新增費用'}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl leading-none p-1">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">項目名稱 *</label>
            <input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="例：晚飯、計程車、景點門票"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                errors.title ? 'border-rose-300 focus:ring-2 focus:ring-rose-100' : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
              }`}
            />
            {errors.title && <p className="text-xs text-rose-500">{errors.title}</p>}
          </div>

          {/* Amount + Currency */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">金額 *</label>
            <div className="flex gap-2">
              <div className="flex rounded-xl border border-slate-200 overflow-hidden flex-shrink-0">
                {['HKD', 'TWD'].map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setField('currency', cur)}
                    className={`px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                      form.currency === cur ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="0"
                step="any"
                value={form.amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className={`flex-1 px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                  errors.amount ? 'border-rose-300 focus:ring-2 focus:ring-rose-100' : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
                }`}
              />
            </div>
            {errors.amount && <p className="text-xs text-rose-500">{errors.amount}</p>}
          </div>

          {/* Paid by */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">由誰付款 *</label>
            <div className="flex flex-wrap gap-2">
              {activeMembers.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handlePaidByChange(m)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    form.paidBy === m
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {errors.paidBy && <p className="text-xs text-rose-500">{errors.paidBy}</p>}
          </div>

          {/* Participants */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600">分擔成員 *</label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setForm((f) => {
                      redistributeSplits(activeMembers, f.splitMode, f.amount);
                      return { ...f, participants: [...activeMembers] };
                    });
                  }}
                  className="text-blue-500 hover:text-blue-700"
                >
                  全選
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm((f) => {
                      const next = form.paidBy ? [form.paidBy] : [];
                      redistributeSplits(next, f.splitMode, f.amount);
                      return { ...f, participants: next };
                    });
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  清除
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeMembers.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleParticipantToggle(m)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    form.participants.includes(m)
                      ? 'bg-teal-500 text-white border-teal-500'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {errors.participants && <p className="text-xs text-rose-500">{errors.participants}</p>}
          </div>

          {/* Split mode */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600">分攤方式</label>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                {SPLIT_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => handleSplitModeChange(m.value)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      form.splitMode === m.value ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Split detail rows */}
            {form.participants.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                {form.participants.map((person) => {
                  const calcAmt = calcSplits[person] ?? 0;
                  return (
                    <div
                      key={person}
                      className={`flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-100 last:border-0 ${
                        person === form.paidBy ? 'bg-slate-50' : ''
                      }`}
                    >
                      <span className={`text-sm font-medium flex-1 ${person === form.paidBy ? 'text-slate-700' : 'text-slate-600'}`}>
                        {person === form.paidBy ? `${person} 👑` : person}
                      </span>

                      {form.splitMode === 'percentage' && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={inputSplits[person] ?? ''}
                            onChange={(e) => setInputSplit(person, e.target.value)}
                            className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-xs text-center outline-none focus:border-teal-400"
                          />
                          <span className="text-xs text-slate-400">%</span>
                        </div>
                      )}

                      {form.splitMode === 'manual' && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-xs text-slate-400">{currSym}</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={inputSplits[person] ?? ''}
                            onChange={(e) => setInputSplit(person, e.target.value)}
                            className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs text-center outline-none focus:border-teal-400"
                          />
                        </div>
                      )}

                      <span className={`text-xs font-semibold flex-shrink-0 w-16 text-right ${
                        form.splitMode !== 'equal' ? 'text-slate-400' : 'text-slate-700'
                      }`}>
                        {currSym}{fmt(calcAmt)}
                      </span>
                    </div>
                  );
                })}

                {/* Totals row */}
                <div className={`flex items-center justify-between px-3.5 py-2 ${
                  Math.abs(splitTotal - amt) > 0.5 && form.splitMode !== 'equal'
                    ? 'bg-rose-50'
                    : 'bg-slate-50'
                }`}>
                  <span className="text-xs text-slate-500">合計</span>
                  <span className={`text-xs font-bold ${
                    Math.abs(splitTotal - amt) > 0.5 && form.splitMode !== 'equal'
                      ? 'text-rose-600'
                      : 'text-slate-700'
                  }`}>
                    {currSym}{fmt(splitTotal)}
                    {form.splitMode !== 'equal' && amt > 0 && Math.abs(splitTotal - amt) > 0.5 && (
                      <span className="ml-1 text-rose-500">≠ {currSym}{fmt(amt)}</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {errors.splits && <p className="text-xs text-rose-500">{errors.splits}</p>}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">備注（選填）</label>
            <input
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="收據號碼、餐廳名稱..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1 pb-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-2xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {saving ? '儲存中...' : isEdit ? '儲存更改' : '新增費用'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
