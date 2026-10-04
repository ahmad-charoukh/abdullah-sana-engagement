// Next.js can use an internal hostname for nextUrl behind a proxy or on a LAN.
// Compare the browser origin with the actual incoming Host as well.
export function allowedRequestOrigin(input: {
  origin: string | null;
  fetchSite: string | null;
  host: string | null;
  forwardedHost: string | null;
  requestOrigin: string;
  appUrl?: string;
}) {
  if (input.fetchSite === 'cross-site') return false;
  if (!input.origin) return true;
  let origin: URL;
  try { origin = new URL(input.origin); } catch { return false; }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.origin !== input.origin) return false;
  const permitted = new Set([input.requestOrigin]);
  if (input.appUrl) {
    try { permitted.add(new URL(input.appUrl).origin); } catch { /* Invalid optional config must not crash public forms. */ }
  }
  if (permitted.has(origin.origin)) return true;
  if (input.host && origin.host.toLowerCase() === input.host.toLowerCase()) return true;
  // Browser Fetch Metadata is not writable by page scripts. Only use a proxy's
  // public host for browser requests explicitly marked same-origin.
  const forwarded = input.forwardedHost?.split(',')[0].trim();
  return input.fetchSite === 'same-origin' && !!forwarded && origin.host.toLowerCase() === forwarded.toLowerCase();
}
