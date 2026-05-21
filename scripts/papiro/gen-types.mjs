#!/usr/bin/env node
// PAPIRO — gen-types: runs `supabase gen types` and strips the CLI upgrade notice.
// The Supabase CLI writes its update notification to stdout (not stderr), so a plain
// `>` redirect captures it as non-TS garbage at the end of the file.

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const cmd = 'supabase gen types typescript --project-id xmtleqquivcukwgdexhc --schema papiro';
const raw = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

// Strip everything after the upgrade notice marker (inclusive)
const marker = '\nA new version of Supabase CLI is available';
const cleaned = raw.includes(marker)
  ? raw.slice(0, raw.indexOf(marker)).trimEnd() + '\n'
  : raw;

writeFileSync('src/types/database.papiro.ts', cleaned, 'utf-8');
console.log(`✓ Wrote ${cleaned.split('\n').length} lines to src/types/database.papiro.ts`);
