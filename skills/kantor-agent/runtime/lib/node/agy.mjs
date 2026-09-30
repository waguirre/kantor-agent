// Fork: eventos de agy (escritos por bin/agy-emit.mjs) → "run" con la misma forma que los de Codex/Claude.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clip, isFile, mtimeSec, oneLine } from './util.mjs';

const EVENTS_KEEP = 40;
const TAIL_MAX = 1024 * 1024;

export function describeAgy(tool, cmd) {
  if (cmd) return oneLine(`Ejecutando: ${cmd} …`, 160);
  return oneLine(clip(tool || 'alat', 60), 160);
}

export function summarizeAgy(text) {
  const by = new Map();
  for (const line of text.split('\n')) {
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof e?.t !== 'string' || typeof e.session !== 'string') continue;
    let run = by.get(e.session);
    if (!run) {
      run = {
        provider: 'agy', agentType: 'agy', description: 'Sesión de agy', parentAgent: null, id: `agy-${e.session.slice(0, 12)}`,
        session: e.session, started: e.t, updated: e.t, tools: 0, tokens: 0, events: [], lastKind: null, limit: null,
        files: [], segs: [], stops: [],
      };
      by.set(e.session, run);
    }
    run.updated = e.t;
    const last = run.segs[run.segs.length - 1];
    if (e.phase === 'stop') {
      if (last && last[1] === null) last[1] = e.t;
      run.lastKind = 'handback';
      continue;
    }
    if (!last || last[1] !== null) run.segs.push([e.t, null]);
    if (e.phase === 'pre' || e.phase === 'post') {
      const txt = describeAgy(e.tool, e.cmd);
      run.tools++;
      run.lastKind = 'tool';
      run.description = txt;
      run.events.push({ t: e.t, kind: 'tool', text: txt, tool: e.tool || null });
      if (run.events.length > EVENTS_KEEP) run.events.shift();
    }
  }
  return [...by.values()];
}

export function scanAgy(nowSec, cfg) {
  const file = path.join(process.env.KANTOR_PROVIDERS_DIR || path.join(os.homedir(), '.cache', 'kantor-agent', 'providers', 'agy'), 'events.jsonl');
  if (!isFile(file) || mtimeSec(file) < nowSec - cfg.window_days * 86400) return [];
  const size = fs.statSync(file).size;
  const fd = fs.openSync(file, 'r');
  try {
    const n = Math.min(size, TAIL_MAX);
    const b = Buffer.alloc(n);
    fs.readSync(fd, b, 0, n, size - n);
    return summarizeAgy(b.toString('utf8'));
  } finally {
    fs.closeSync(fd);
  }
}
