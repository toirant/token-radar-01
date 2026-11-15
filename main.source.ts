// Token Radar — the entrypoint (model radar-2).
//
// One run reads the sealed DefiLlama snapshot, scores every pre-token protocol by
// what its launch would be worth, and writes the whole hand-in into the output
// directory: the ranked board, the dashboard's data, the dashboard and its
// screenshots, and the dossier the judge reads. Nothing here reaches the network
// and nothing here is installed: Node's standard library only, run as
// `node --experimental-strip-types main.ts --input <snapshot.json>` with
// MAKEFUN_OUTPUT_DIR naming where the hand-in goes (the sandbox runs it with
// the snapshot at /input/snapshot.json and the output at /output).
//
// The scoring itself lives in lib/model.ts: buildRadar turns the snapshot into
// the board (the watchlist, plus the early pre-token finds below the floor,
// ranked by implied value) and the radar data the page renders. This file only
// wires that model to the filesystem: read, check, write, copy, dossier.

import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import {
  MODEL,
  MODEL_VERSION,
  boardIssue,
  buildRadar,
  dataScript,
  parseSnapshot,
} from './lib/model.ts';

/** This file's own directory: the repository root, wherever the run starts from. */
const REPO_ROOT = fileURLToPath(new URL('.', import.meta.url));

/** The value after a `--name value` or `--name=value` argument, else `fallback`. */
function flag(argv: string[], name: string, fallback: string | undefined): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === name && i + 1 < argv.length) return argv[i + 1];
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return fallback;
}

function main(): void {
  const argv = process.argv.slice(2);
  const inputPath = flag(argv, '--input', process.env.MAKEFUN_INPUT ?? '/input/snapshot.json')!;
  const outDir = flag(argv, '--output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output')!;

  // Read and score the snapshot. parseSnapshot refuses anything that is not
  // the shape the model scores, so a bad input fails here, before any file
  // is written.
  const snapshot = parseSnapshot(readFileSync(inputPath, 'utf8'));
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) throw new Error(`token-radar: board refused: ${issue}`);

  // The board, with the model that made it, so a reader can see the claim
  // and the figures behind it in one file.
  const boardDoc = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    model: MODEL,
    watchlist_size: radar.watchlist_size,
    board_size: radar.board_size,
    early_size: radar.early_size,
    live_size: radar.live_size,
    overall_multiple: radar.overall_multiple,
    multiples: radar.multiples,
    comparable_counts: radar.comparable_counts,
    rows: board,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'board.json'), `${JSON.stringify(boardDoc, null, 2)}\n`, 'utf8');
  writeFileSync(join(outDir, 'data.js'), dataScript(radar), 'utf8');

  // The page and its screenshots, copied whole: the dossier is built from
  // these copies, so what the judge reads is exactly what was handed in.
  cpSync(join(REPO_ROOT, 'dashboard'), join(outDir, 'dashboard'), { recursive: true });
  cpSync(join(REPO_ROOT, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

  // The dossier, from the output directory just written: buildDossier reads
  // dashboard/ and screenshots/ back and refuses anything it cannot vouch for.
  const dossier = buildDossier(outDir, { text_max_bytes: 65536 });
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  const top = board[0]?.implied_value_usd ?? 0;
  const bottom = board[board.length - 1]?.implied_value_usd ?? 0;
  console.log(
    `token-radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} watchlist, ` +
      `${board.length} board rows, implied $${top} to $${bottom}, ` +
      `dossier ${dossier.length} bytes -> ${outDir}`,
  );
}

main();
