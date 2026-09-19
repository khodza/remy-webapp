/**
 * The calendar feed path from the API ("/calendar/<secret>.ics") made into
 * the links a calendar app needs. `apiUrl` is what the app calls the API
 * with (absolute in production, "/api/v1/…" behind the dev proxy).
 */
export interface FeedLinks {
  /** Paste into any calendar's "subscribe by URL". */
  https: string;
  /** Opens Apple Calendar's subscribe dialog. */
  webcal: string;
  /** Google Calendar's "add by URL" page with the link filled in. */
  google: string;
  /** The link points at this computer: calendars on the internet can't fetch it. */
  local: boolean;
}

export function feedLinks(apiUrl: string, origin: string): FeedLinks {
  const url = new URL(apiUrl, origin);
  const https = url.toString();
  const webcal = https.replace(/^https?:/, 'webcal:');
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    local: /^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/.test(url.hostname) || url.hostname.endsWith('.local'),
  };
}
