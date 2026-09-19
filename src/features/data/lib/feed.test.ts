import { describe, expect, it } from 'vitest';
import { feedLinks } from './feed';

describe('feedLinks', () => {
  it('makes an absolute link from an absolute API base', () => {
    const links = feedLinks('https://api.remy.dev/api/v1/calendar/abc.ics', 'https://app.remy.dev');
    expect(links).toEqual({
      https: 'https://api.remy.dev/api/v1/calendar/abc.ics',
      webcal: 'webcal://api.remy.dev/api/v1/calendar/abc.ics',
      google: 'https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fapi.remy.dev%2Fapi%2Fv1%2Fcalendar%2Fabc.ics',
      local: false,
    });
  });

  it('uses the page origin behind the dev proxy and flags local hosts', () => {
    expect(feedLinks('/api/v1/calendar/abc.ics', 'https://x.ngrok-free.dev').https).toBe('https://x.ngrok-free.dev/api/v1/calendar/abc.ics');
    expect(feedLinks('/api/v1/calendar/abc.ics', 'http://localhost:5173').local).toBe(true);
    expect(feedLinks('/api/v1/calendar/abc.ics', 'http://192.168.1.4:5173').local).toBe(true);
  });
});
