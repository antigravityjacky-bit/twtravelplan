import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import ItineraryPlaceItem from './ItineraryPlaceItem';

export default function ItineraryDay({
  dayNumber,
  items,          // itinerary_items for this day (sorted)
  placesById,     // { [place_id]: place }
  days,           // all day numbers (for DayPicker in sibling — not used here)
  onReorder,      // (newOrderedIds) => void
  onRemoveItem,   // (id) => void
  onRemoveDay,    // () => void
  onAddItem,      // (place_id) => void — triggered by the "+ 加入地點" button
  // DayPicker state lifted up so only one picker is open at a time
  pickerOpen,
  onOpenPicker,
  onClosePicker,
  placeLibrary,   // all places for DayPicker search
}) {
  const [pickerSearch, setPickerSearch] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Real items only (exclude sentinels with place_id = null)
  const realItems = items.filter((i) => i.place_id !== null);
  const sortableIds = realItems.map((i) => i.id);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortableIds.indexOf(active.id);
    const newIndex = sortableIds.indexOf(over.id);
    const newOrder = arrayMove(sortableIds, oldIndex, newIndex);
    onReorder(newOrder);
  }

  // Filtered place list for the picker
  const filteredLibrary = placeLibrary.filter((p) => {
    if (!pickerSearch.trim()) return true;
    const q = pickerSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.nameEn ?? '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Day header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="font-semibold text-slate-700 text-sm">
          Day {dayNumber}
          <span className="ml-2 text-xs font-normal text-slate-400">
            {realItems.length} 個地點
          </span>
        </h2>
        <button
          onClick={onRemoveDay}
          className="text-slate-300 hover:text-rose-500 transition-colors text-sm px-1"
          aria-label={`移除 Day ${dayNumber}`}
        >
          ✕
        </button>
      </div>

      {/* Sortable item list */}
      <div className="px-3 py-2">
        {realItems.length === 0 ? (
          <p className="text-xs text-slate-300 text-center py-3">（尚未加入地點）</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {realItems.map((item) => (
                <ItineraryPlaceItem
                  key={item.id}
                  item={item}
                  place={placesById[item.place_id]}
                  onRemove={onRemoveItem}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add place button + picker */}
      <div className="relative px-3 pb-3">
        <button
          onClick={() => pickerOpen ? onClosePicker() : onOpenPicker()}
          className="w-full text-xs text-slate-400 hover:text-slate-700 border border-dashed border-slate-200 hover:border-slate-400 rounded-xl py-2 transition-colors"
        >
          ＋ 加入地點
        </button>

        {pickerOpen && (
          <div className="absolute left-3 right-3 bottom-full mb-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            {/* Search */}
            <div className="px-3 pt-3 pb-2 border-b border-slate-100">
              <input
                autoFocus
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="搜尋地點..."
                className="w-full text-sm px-3 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
            {/* List */}
            <div className="max-h-52 overflow-y-auto">
              {filteredLibrary.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">找不到地點</p>
              ) : (
                filteredLibrary.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => {
                      onAddItem(place.id);
                      onClosePicker();
                      setPickerSearch('');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                  >
                    <span className="font-medium">{place.name}</span>
                    {place.nameEn && (
                      <span className="ml-1.5 text-xs text-slate-400">{place.nameEn}</span>
                    )}
                    <span className="ml-2 text-xs text-slate-400">{place.category}</span>
                  </button>
                ))
              )}
            </div>
            {/* Close */}
            <div className="px-3 py-2 border-t border-slate-100">
              <button
                onClick={() => { onClosePicker(); setPickerSearch(''); }}
                className="w-full text-xs text-slate-400 hover:text-slate-600"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
