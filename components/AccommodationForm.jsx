import { useState, useEffect } from 'react';

const TYPES = [
  { value: 'Hotel',  label: '🏨 Hotel',  active: 'bg-violet-500 text-white border-violet-500' },
  { value: 'Airbnb', label: '🏠 Airbnb', active: 'bg-rose-500 text-white border-rose-500' },
  { value: 'Hostel', label: '🛏️ Hostel', active: 'bg-amber-500 text-white border-amber-500' },
  { value: 'Other',  label: '🏡 Other',  active: 'bg-slate-600 text-white border-slate-600' },
];

const EMPTY = {
  name: '',
  type: 'Hotel',
  price: '',
  location: '',
  address: '',
  link: '',
  image_url: '',
  notes: '',
};

export default function AccommodationForm({ initial, onSave, onCancel, saving = false }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [imgPreview, setImgPreview] = useState(false);

  useEffect(() => {
    setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
    setErrors({});
    setImgPreview(false);
  }, [initial]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = '必填';
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({
      name:      form.name.trim(),
      type:      form.type,
      price:     form.price.trim(),
      location:  form.location.trim(),
      address:   form.address.trim(),
      link:      form.link.trim(),
      image_url: form.image_url.trim(),
      notes:     form.notes.trim(),
    });
  }

  const isEdit = !!initial;
  const submitLabel = saving ? '儲存中...' : isEdit ? '儲存更改' : '新增住宿';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            {isEdit ? '編輯住宿' : '新增住宿'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <Field label="名稱 *" error={errors.name}>
            <input
              className={inp(errors.name)}
              placeholder="例：W Hotel Taipei"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>

          {/* Type */}
          <Field label="類型 *">
            <div className="flex gap-2 flex-wrap">
              {TYPES.map(({ value, label, active }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('type', value)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    form.type === value ? active : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {/* Price + Location */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="價格">
              <input
                className={inp()}
                placeholder="NT$3,500/晚"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
            </Field>
            <Field label="位置">
              <input
                className={inp()}
                placeholder="信義區"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
              />
            </Field>
          </div>

          {/* Address */}
          <Field label="地址">
            <input
              className={inp()}
              placeholder="台北市信義區忠孝東路五段10號（選填）"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
            />
          </Field>

          {/* Booking link */}
          <Field label="預訂連結">
            <input
              className={inp()}
              type="url"
              placeholder="https://www.booking.com/... （選填）"
              value={form.link}
              onChange={(e) => set('link', e.target.value)}
            />
          </Field>

          {/* Image URL */}
          <Field label="圖片 URL">
            <div className="space-y-2">
              <input
                className={inp()}
                type="url"
                placeholder="https://... 貼入酒店/Airbnb 圖片連結（選填）"
                value={form.image_url}
                onChange={(e) => { set('image_url', e.target.value); setImgPreview(false); }}
              />
              {form.image_url && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setImgPreview((v) => !v)}
                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                  >
                    {imgPreview ? '隱藏預覽' : '預覽圖片'}
                  </button>
                </div>
              )}
              {imgPreview && form.image_url && (
                <img
                  src={form.image_url}
                  alt="preview"
                  className="w-full h-40 object-cover rounded-xl border border-slate-200"
                  onError={() => setImgPreview(false)}
                />
              )}
            </div>
          </Field>

          {/* Notes */}
          <Field label="備注">
            <textarea
              className={`${inp()} resize-none`}
              rows={2}
              placeholder="例：近捷運、有早餐、適合2人... （選填）"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
    </div>
  );
}

function inp(error) {
  return `w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-300 outline-none transition-all ${
    error
      ? 'border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
      : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
  }`;
}
