#!/usr/bin/env node
/**
 * Validate that all TemplateVersion.dataJson values are valid JSON strings.
 * Provides summary stats to prepare for converting the column from TEXT -> JSON.
 *
 * Usage:
 *   npm run validate:templateversion-json
 *   npm run validate:templateversion-json -- --limit 50
 */
import { PrismaClient } from '@prisma/client';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: undefined };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      opts.limit = Number(args[i + 1]);
      i++; // skip value
    }
  }
  return opts;
}

async function main() {
  const prisma = new PrismaClient();
  const { limit } = parseArgs();
  const start = Date.now();
  const rows = await prisma.$queryRawUnsafe(`SELECT id, dataJson FROM TemplateVersion${limit ? ' LIMIT ' + Number(limit) : ''}`);

  /** @type {{ id: string; error: string; snippet: string }[]} */
  const failures = [];
  let totalKeys = 0;
  let objects = 0;

  for (const r of rows) {
    const raw = r.dataJson;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        objects++;
        totalKeys += Object.keys(parsed).length;
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'unknown';
      failures.push({ id: r.id, error: errMsg, snippet: (raw || '').slice(0, 120) });
    }
  }

  const durationMs = Date.now() - start;
  const avgKeys = objects ? (totalKeys / objects).toFixed(2) : '0';

  if (failures.length === 0) {
    console.log(`✅ All ${rows.length} TemplateVersion rows have valid JSON (checked in ${durationMs}ms). Avg object keys: ${avgKeys}`);
  } else {
    console.log(`❌ ${failures.length} / ${rows.length} rows failed JSON parse (checked in ${durationMs}ms)`);
    for (const f of failures.slice(0, 25)) {
      console.log(` - id=${f.id} error=${f.error} snippet=${JSON.stringify(f.snippet)}`);
    }
    if (failures.length > 25) console.log(`... (${failures.length - 25} more failures)`);
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Unexpected failure running validator:', e);
  process.exit(1);
});
