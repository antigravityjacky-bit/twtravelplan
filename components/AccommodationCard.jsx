import { useState } from 'react';

const TYPE_CONFIG = {
  Hotel:   { emoji: '🏨', bg: 'bg-violet-100 text-violet-700 ring-violet-200' },
  Airbnb:  { emoji: '🏠', bg: 'bg-rose-100 text-rose-700 ring-rose-200' },
  Hostel:  { emoji: '🛏️', bg: 'bg-amber-100 text-amber-700 ring-amber-200' },
  Other:   { emoji: '🏡', bg: 'bg-slate-100 text-slate-700 ring-slate-200' },
};

export default function AccommodationCard({ accommodation, onEdit, onDelete }) {
  const [imgError, setImgError] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const { name, type, price, location, address, link, image_url, notes } = accommodation;
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.Other;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Image area */}
      <div className="relative h-48 bg-slate-100 flex-shrink-0">
        {image_url && !imgError ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl opacity-30">{cfg.emoji}</span>
          </div>
        )}
        {/* Type badge — top right */}
        <span className={`absolute top-3 right-3 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 shadow-sm bg-white/90 backdrop-blur-sm ${cfg.bg}`}>
          {cfg.emoji} {type}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <h3 className="font-semibold text-slate-800 text-base leading-snug">{name}</h3>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          {location && <span>📍 {location}</span>}
          {price && (
            <span className="font-medium text-slate-700">{price}</span>
          )}
        </div>

        {address && (
          <p className="text-xs text-slate-400 leading-snug">{address}</p>
        )}

        {notes && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 mt-0.5">{notes}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-50">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-xl bg-slate-800 text-white hover:bg-slate-900 transition-colors"
            >
              🔗 查看預訂
            </a>
          ) : (
            <div className="flex-1" />
          )}
          <button
            onClick={() => onEdit(accommodation)}
            className="text-xs px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
          >
            ✏️ 編輯
          </button>
          {confirmDel ? (
            <div className="flex gap-1">
              <button
                onClick={() => onDelete(accommodation.id)}
                className="text-xs px-2.5 py-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors"
              >
                確認
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="text-xs px-2.5 py-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              className="text-xs px-3 py-2 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
