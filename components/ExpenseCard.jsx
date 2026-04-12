function fmt(n, sym) {
  if (!isFinite(n)) return '—';
  return sym + n.toFixed(n % 1 === 0 ? 0 : 1);
}

export default function ExpenseCard({ expense, displayCurrency, rate, onEdit, onDelete }) {
  const { title, amount, currency, paid_by, splits = {}, notes } = expense;

  const factor = currency === displayCurrency ? 1
    : displayCurrency === 'TWD' ? parseFloat(rate)
    : 1 / parseFloat(rate);

  const displayAmount = amount * factor;
  const sym = displayCurrency === 'HKD' ? 'HK$' : 'NT$';
  const origSym = currency === 'HKD' ? 'HK$' : 'NT$';
  const showOrig = currency !== displayCurrency;

  const participants = Object.entries(splits);
  const count = participants.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 text-sm leading-snug">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            <span className="font-medium text-slate-600">{paid_by}</span> 付款
            {count > 0 && <> · {count} 人分攤</>}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-slate-800 text-base">{fmt(displayAmount, sym)}</p>
          {showOrig && (
            <p className="text-xs text-slate-400">{origSym}{amount}</p>
          )}
        </div>
      </div>

      {/* Splits */}
      {count > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {participants.map(([name, amt]) => {
            const displayAmt = parseFloat(amt) * factor;
            const isPayer = name === paid_by;
            return (
              <span
                key={name}
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                  isPayer
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {name}{isPayer && ' 👑'} {fmt(displayAmt, sym)}
              </span>
            );
          })}
        </div>
      )}

      {/* Notes */}
      {notes && (
        <p className="px-4 pb-3 text-xs text-slate-400 italic">{notes}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 px-3 pb-3 border-t border-slate-50 pt-2">
        <button
          onClick={() => onEdit(expense)}
          className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          ✏️ 編輯
        </button>
        <button
          onClick={() => onDelete(expense.id)}
          className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
        >
          🗑️ 刪除
        </button>
      </div>
    </div>
  );
}
