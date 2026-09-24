/**
 * How the server will store a list name (its common/list-name.ts): trimmed,
 * single-spaced, lower case, without a leading "the"/"my" or a trailing
 * "list", at most 40 characters. Shown as a preview before saving; the
 * server's answer is the truth.
 */
export function normaliseListName(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let name = raw.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  name = name.replace(/^(the|my)\s+/u, '');
  name = name.replace(/\s+list$/u, '');
  name = name.slice(0, 40).trim();
  return name === '' ? null : name;
}

/** "shopping" → "Shopping" for headers and pills. */
export function listTitle(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}
