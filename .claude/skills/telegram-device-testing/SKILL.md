---
name: telegram-device-testing
description: How to test the Remy Mini App on real Telegram clients — test DC vs prod DC setup, tunnels, and inspecting the webview on Android, iOS, and Telegram Desktop.
---

## Telegram test DC vs prod DC

Primary dev loop is **Telegram test DC** — no tunnel needed.
On mobile: Settings → tap version ×10 → Accounts → Login to another → Test.
In BotFather test DC, `http://` and bare IPs are accepted for Mini App URL.

Real device testing on prod DC requires `pnpm dev:tunnel` — `vite-plugin-mkcert`
self-signed certs are rejected by iOS/Android Telegram.

## Debugging live devices

- **Android WebView**: tap the Telegram version 2× to enable WebView debug, then
  open chrome://inspect on your laptop.
- **iOS**: open Safari Web Inspector on your Mac against the paired device.
- **Telegram Desktop Beta**: Settings → Advanced → Experimental → enable webview
  inspection → right-click inside Mini App → Inspect.
