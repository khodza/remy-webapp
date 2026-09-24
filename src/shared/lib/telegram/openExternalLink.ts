import { openLink } from '@telegram-apps/sdk-react';

/**
 * Opens an http(s) URL outside the Mini App: Telegram hands it to the
 * system browser; a plain browser gets a new tab. False when neither
 * worked (a webview that refused the scheme), so the caller can fall back.
 */
export function openExternalLink(url: string): boolean {
  try {
    if (openLink.isAvailable()) openLink(url);
    else if (!window.open(url, '_blank', 'noopener')) return false;
    return true;
  } catch {
    return false;
  }
}
