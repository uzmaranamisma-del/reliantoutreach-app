"use client";

import { useEffect, useRef, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstall() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt>();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setReady(true);
    const mode = window.matchMedia("(display-mode: standalone)");
    const appleNavigator = navigator as Navigator & { standalone?: boolean };
    setInstalled(mode.matches || Boolean(appleNavigator.standalone));
    setIos(/iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(undefined);
      dialog.current?.close();
    };
    const onModeChange = (event: MediaQueryListEvent) => setInstalled(event.matches);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    mode.addEventListener("change", onModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mode.removeEventListener("change", onModeChange);
    };
  }, []);

  async function install() {
    if (!prompt) {
      dialog.current?.showModal();
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(undefined);
  }

  if (!ready || installed) return null;
  return (
    <>
      <button className="pwa-install-action" type="button" onClick={install}>
        Install app
      </button>
      <dialog ref={dialog} className="pwa-install-dialog" aria-labelledby="pwa-install-title">
        <h2 id="pwa-install-title">Install ReliantOutreach</h2>
        {ios ? (
          <p>Open app.reliantoutreach.com in Safari. Tap Share → Add to Home Screen → Add. Keep “Open as Web App” on if shown.</p>
        ) : (
          <p>Open app.reliantoutreach.com in Chrome. Tap the ⋮ menu → Add to Home screen or Install app → Install.</p>
        )}
        <p>If you opened this link inside WhatsApp, Facebook, Gmail or another app, choose “Open in browser” first. Private browsing may hide installation options.</p>
        <p>Then open the new Home Screen icon, sign in and tap Enable alerts to allow notifications.</p>
        <button type="button" onClick={() => dialog.current?.close()}>Got it</button>
      </dialog>
    </>
  );
}
