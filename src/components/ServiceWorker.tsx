'use client';

import { useEffect } from 'react';

/**
 * Registers public/sw.js once the page is interactive. The worker only caches
 * the shell — never /api, never a balance (rule 8).
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('service worker registration failed', err);
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
