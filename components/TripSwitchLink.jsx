import Link from 'next/link';

export default function TripSwitchLink() {
  return (
    <Link
      href="/trips"
      className="text-xs font-medium text-teal-600 px-2 py-1 rounded-lg border border-teal-200 hover:bg-teal-50 flex-shrink-0 transition-colors"
    >
      ✈️ 切換行程
    </Link>
  );
}
