import { useEffect } from 'react';
import Head from 'next/head';
import 'leaflet/dist/leaflet.css';
import '../styles/globals.css';
import { TripProvider } from '../context/TripContext';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <TripProvider>
      <>
        <Head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#1e293b" />
          <link rel="apple-touch-icon" href="/icon.png" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="Trip Planner" />
        </Head>
        <Component {...pageProps} />
      </>
    </TripProvider>
  );
}
