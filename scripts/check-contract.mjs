#!/usr/bin/env node
// Verifies src/shared/api/contract.gen.ts is an untouched copy of the
// backend contract:
//  (a) the contract-sha256 banner matches the body that follows it, so a
//      hand edit of the generated file is caught even without the backend;
//  (b) when the sibling backend repo is present, the body equals its source
//      byte for byte, so a stale copy is caught too.
// The banner format is owned by ../remy/scripts/sync-contract.mjs.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generated = resolve(root, 'src/shared/api/contract.gen.ts');
const backendSource = resolve(
  process.env.REMY_BACKEND_DIR ?? resolve(root, '../remy'),
  'src/contract/remy-contract.ts',
);
const FIX = 'Regenerate it from the backend repo: (cd ../remy && npm run contract:sync)';

function fail(message) {
  console.error(`✗ ${message}\n  ${FIX}`);
  process.exit(1);
}

if (!existsSync(generated)) fail(`${generated} is missing.`);

const text = readFileSync(generated, 'utf8');
// Banner = 4 comment lines + one blank line, then the verbatim source.
const banner =
  /^\/\/ GENERATED FILE — DO NOT EDIT\.\n\/\/ Source: [^\n]*\n\/\/ Regenerate [^\n]*\n\/\/ contract-sha256: ([0-9a-f]{64})\n\n/.exec(
    text,
  );
if (!banner) fail('contract.gen.ts has no valid generated-file banner.');

const body = text.slice(banner[0].length);
const actual = createHash('sha256').update(body).digest('hex');
if (actual !== banner[1]) {
  fail('contract.gen.ts was edited by hand (body does not match its contract-sha256).');
}

if (existsSync(backendSource)) {
  if (readFileSync(backendSource, 'utf8') !== body) {
    fail('contract.gen.ts is out of date with ../remy/src/contract/remy-contract.ts.');
  }
  console.log(`✓ contract.gen.ts matches the backend contract (${actual.slice(0, 12)})`);
} else {
  console.log(
    `✓ contract.gen.ts is intact (${actual.slice(0, 12)}); backend repo not found, skipped the freshness check`,
  );
}
