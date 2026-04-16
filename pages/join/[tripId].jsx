import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useTrip } from '../../context/TripContext';

export default function JoinTrip() {
  const router = useRouter();
  const { tripId: urlTripId } = router.query;
  const { activateTrip } = useTrip();
  const [status, setStatus] = useState('loading'); // 'loading' | 'joining' | 'error'
  const [tripName, setTripName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!urlTripId) return;

    async function join() {
      if (!supabase) {
        setErrorMsg('需要 Supabase 才能加入行程');
        setStatus('error');
        return;
      }

      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', urlTripId)
        .single();

      if (error || !data) {
        setErrorMsg('找不到這個行程，請確認連結是否正確');
        setStatus('error');
        return;
      }

      setTripName(data.name);
      setStatus('joining');
      activateTrip(data.id);

      setTimeout(() => {
        router.replace('/');
      }, 1500);
    }

    join();
  }, [urlTripId, activateTrip, router]);

  return (
    <>
      <Head>
        <title>加入行程 — Trip Planner</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          {status === 'loading' && (
            <>
              <p className="text-4xl mb-4 animate-pulse">✈️</p>
              <p className="font-semibold text-slate-800">正在尋找行程...</p>
            </>
          )}

          {status === 'joining' && (
            <>
              <p className="text-4xl mb-4">🎉</p>
              <p className="font-semibold text-slate-800 mb-1">加入成功！</p>
              <p className="text-sm text-slate-500 mb-4">{tripName}</p>
              <p className="text-xs text-slate-400">正在跳轉...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <p className="text-4xl mb-4">😕</p>
              <p className="font-semibold text-slate-800 mb-2">無法加入行程</p>
              <p className="text-sm text-slate-500 mb-6">{errorMsg}</p>
              <Link
                href="/trips"
                className="inline-block px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors"
              >
                前往行程管理
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
