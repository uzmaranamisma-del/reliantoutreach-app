import { AppError } from "./errors";
export function validatePushEndpoint(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError(422, "Invalid push endpoint."); }
  // Only service-owned hosts; never user-selected destinations or addresses.
  const allowed = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
  const wns = /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password || url.hash || (!allowed.includes(url.hostname) && !wns))
    throw new AppError(422, "This push service is not supported. Use Chrome, Safari, Firefox or Edge.");
  return url.toString();
}
