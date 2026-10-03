"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    // Keep push notifications working without showing an install prompt.
    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);
  }, []);

  return null;
}
