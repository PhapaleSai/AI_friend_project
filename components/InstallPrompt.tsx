'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'friend-ai-install-dismissed';

/** Chrome/Edge fire this when the app meets the installability criteria. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari doesn't support display-mode, it exposes this instead.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already running as an installed app, or the user dismissed this before.
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;

    // iOS has no beforeinstallprompt — Add to Home Screen is manual, so we
    // show instructions instead of a button.
    const ua = navigator.userAgent;
    const iOS = /iphone|ipad|ipod/i.test(ua) ||
      // iPadOS 13+ reports as Mac but has touch
      (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    if (iOS) {
      setShowIosHelp(true);
      setVisible(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferred(null);
  };

  if (!visible) return null;

  return (
    <div
      className="relative z-20 w-full max-w-[380px] mb-5 rounded-2xl px-4 py-3 flex items-center gap-3"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-lg"
        style={{ background: 'linear-gradient(135deg, #c084fc, #f97316)' }}
      >
        📲
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white leading-tight">
          {showIosHelp ? 'Install as an app' : 'Install Friend AI'}
        </p>
        <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
          {showIosHelp
            ? 'Tap Share, then "Add to Home Screen"'
            : 'Opens fullscreen, works offline'}
        </p>
      </div>

      {!showIosHelp && (
        <button
          onClick={install}
          className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-95 focus:outline-none"
          style={{ background: 'linear-gradient(135deg, #c084fc, #f97316)' }}
        >
          Install
        </button>
      )}

      <button
        onClick={dismiss}
        className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-colors focus:outline-none"
        aria-label="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>
  );
}
