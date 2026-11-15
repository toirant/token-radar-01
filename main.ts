// Token Radar (model radar-2): the program the grader runs.
//
// It reads one sealed DefiLlama snapshot, scores every pre-token protocol by an
// implied value, and writes the ranked board plus the static dashboard the
// reader farms from. Standard library only, erasable TypeScript, so it runs
// under plain `node main.ts` with no flags, no build and no install.
//
//   node main.ts [--input <snapshot.json>] [--output <dir>]
//
// The snapshot defaults to /input/snapshot.json and the output to /output,
// the paths the grading sandbox mounts; MAKEFUN_INPUT_DIR and
// MAKEFUN_OUTPUT_DIR override them the same way (MAKEFUN_INPUT_DIR names
// either the snapshot file itself or the directory holding snapshot.json).
// Everything the run writes lands under the output directory:
//
//   board.json      the ranked board: model metadata plus one row per protocol
//   data.js         window.RADAR, the dashboard's whole dataset, no fetch
//   dashboard/      a copy of this repo's dashboard/ (index, css, js)
//   screenshots/    a copy of this repo's screenshots/ (the dossier's cover)
//   dossier.json    buildDossier's dossier of dashboard/ + screenshots/
//
// The scoring itself lives in lib/model.ts (buildRadar / buildBoard): the
// category multiple is the snapshot's own comparable median, growth and
// maturity and breadth are multipliers on the protocol's own figures, and no
// protocol name is ever special-cased. This file only wires that model to
// the snapshot on disk and the files the gate reads.

import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODEL, MODEL_VERSION, boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const TEXT_MAX_BYTES = 65_536;

/** The directory this file lives in: the repository root at grading time. */
const REPO_ROOT = dirname(fileURLToPath(import.meta.url));

/** The value of a `--flag value` or `--flag=value` argument, or undefined. */
function flagValue(argv: string[], flag: string): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === flag && i + 1 < argv.length) return argv[i + 1];
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
  }
  return undefined;
}

/** Where the snapshot comes from: flag, then env var, then the sealed path. */
function snapshotPath(argv: string[]): string {
  const flag = flagValue(argv, '--input');
  if (flag !== undefined) return flag;
  const dir = process.env.MAKEFUN_INPUT_DIR;
  if (dir !== undefined && dir !== '') {
    return dir.endsWith('.json') ? dir : join(dir, 'snapshot.json');
  }
  return '/input/snapshot.json';
}

/** Where the run writes: flag, then env var, then the sandbox path. */
function outputDir(argv: string[]): string {
  const flag = flagValue(argv, '--output');
  if (flag !== undefined) return flag;
  const env = process.env.MAKEFUN_OUTPUT_DIR;
  if (env !== undefined && env !== '') return env;
  return '/output';
}

function main(): void {
  const argv = process.argv.slice(2);
  const input = snapshotPath(argv);
  const out = outputDir(argv);

  const snapshot = parseSnapshot(readFileSync(input, 'utf8'));
  const { board, radar } = buildRadar(snapshot, MODEL);

  const issue = boardIssue(board, snapshot);
  if (issue !== null) throw new Error(`board rejected: ${issue}`);

  mkdirSync(out, { recursive: true });

  // The board document: the model that scored it, then the ranked rows.
  const boardDoc = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: MODEL,
    model_version: MODEL_VERSION,
    watchlist_size: radar.watchlist_size,
    board_size: radar.board_size,
    early_size: radar.early_size,
    live_size: radar.live_size,
    overall_multiple: radar.overall_multiple,
    rows: board,
  };
  writeFileSync(join(out, 'board.json'), `${JSON.stringify(boardDoc, null, 2)}\n`, 'utf8');

  // The dashboard's dataset, beside the page (dashboard/index.html loads
  // ../data.js): the board in compact form, the live set, and the model.
  writeFileSync(join(out, 'data.js'), dataScript(radar), 'utf8');

  // The page and its screenshots, copied whole: the dossier is built from
  // these copies, so what the judge reads is exactly what ships.
  cpSync(join(REPO_ROOT, 'dashboard'), join(out, 'dashboard'), { recursive: true });
  cpSync(join(REPO_ROOT, 'screenshots'), join(out, 'screenshots'), { recursive: true });

  // The dossier, byte for byte what the scorer rebuilds from the same files.
  const dossier = buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES });
  writeFileSync(join(out, 'dossier.json'), dossier);

  const first = board[0]!;
  const last = board[board.length - 1]!;
  console.log(
    `token-radar ${MODEL_VERSION}: ${snapshot.protocols.length} protocols, ` +
      `${snapshot.watchlist.length} watchlist, ${board.length} board rows, ` +
      `implied $${first.implied_value_usd.toLocaleString('en-US')} (${first.slug}) ` +
      `down to $${last.implied_value_usd.toLocaleString('en-US')} (${last.slug}), ` +
      `dossier ${dossier.length} bytes -> ${out}`,
  );
}

try {
  main();
} catch (err) {
  console.error(`token-radar: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
