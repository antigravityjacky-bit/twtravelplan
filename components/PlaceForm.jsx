import { useState, useEffect } from 'react';

const CATEGORIES = ['Food', 'Attraction', 'Hotel', 'Bar'];

const EMPTY = {
  name: '',
  nameEn: '',
  category: 'Food',
  address: '',
  description: '',
  lat: '',
  lng: '',
};

export default function PlaceForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(initial ? { ...initial, lat: String(initial.lat), lng: String(initial.lng) } : EMPTY);
    setErrors({});
  }, [initial]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = '必填';
    if (!form.address.trim()) e.address = '必填';
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || lat < 20 || lat > 27) e.lat = '請輸入有效台灣緯度 (約 22–25)';
    if (isNaN(lng) || lng < 118 || lng > 123) e.lng = '請輸入有效台灣經度 (約 120–122)';
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({
      ...form,
      name: form.name.trim(),
      nameEn: form.nameEn.trim(),
      address: form.address.trim(),
      description: form.description.trim(),
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
    });
  }

  const isEdit = !!initial;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {isEdit ? '編輯地點' : '新增地點'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              緯度/經度可從 Google Maps 右鍵複製
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <Field label="名稱 *" error={errors.name}>
            <input
              className={input(errors.name)}
              placeholder="例：阜杭豆漿"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>

          {/* English Name */}
          <Field label="英文名稱">
            <input
              className={input()}
              placeholder="例：Fuhang Soy Milk"
              value={form.nameEn}
              onChange={(e) => set('nameEn', e.target.value)}
            />
          </Field>

          {/* Category */}
          <Field label="分類 *">
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => set('category', cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    form.category === cat
                      ? CATEGORY_ACTIVE[cat]
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {CATEGORY_EMOJI[cat]} {cat}
                </button>
              ))}
            </div>
          </Field>

          {/* Address */}
          <Field label="地址 *" error={errors.address}>
            <input
              className={input(errors.address)}
              placeholder="例：台北市中正區忠孝東路一段108號"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
            />
          </Field>

          {/* Description */}
          <Field label="簡介">
            <textarea
              className={`${input()} resize-none`}
              rows={2}
              placeholder="一兩句介紹..."
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>

          {/* Lat / Lng */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="緯度 (Lat) *" error={errors.lat}>
              <input
                className={input(errors.lat)}
                placeholder="25.0453"
                value={form.lat}
                onChange={(e) => set('lat', e.target.value)}
              />
            </Field>
            <Field label="經度 (Lng) *" error={errors.lng}>
              <input
                className={input(errors.lng)}
                placeholder="121.5185"
                value={form.lng}
                onChange={(e) => set('lng', e.target.value)}
              />
            </Field>
          </div>

          {/* Coord helper */}
          <a
            href="https://maps.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >
            <span>🗺️</span> 去 Google Maps 搵座標（右鍵地點 → 複製經緯度）
          </a>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm"
            >
              {isEdit ? '儲存更改' : '新增地點'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helpers
function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
    </div>
  );
}

function input(error) {
  return `w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-300 outline-none transition-all ${
    error
      ? 'border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
      : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
  }`;
}

const CATEGORY_ACTIVE = {
  Food:       'bg-amber-400 text-white border-amber-400',
  Attraction: 'bg-blue-500 text-white border-blue-500',
  Hotel:      'bg-violet-500 text-white border-violet-500',
  Bar:        'bg-rose-500 text-white border-rose-500',
};

const CATEGORY_EMOJI = { Food: '🍜', Attraction: '🗺️', Hotel: '🏨', Bar: '🍸' };
