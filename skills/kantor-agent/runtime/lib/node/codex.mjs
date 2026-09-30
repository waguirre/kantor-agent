// Fork: ringkasan satu sesi Codex (rollout JSONL) menjadi "run" berbentuk sama dengan subagent Claude,
// sehingga penugasan meja di office.mjs tidak berubah. Hanya Node. Yang dibaca: jenis peristiwa, nama alat,
// perintah singkat, penanda mulai/selesai giliran. Isi pesan dan output alat tidak disentuh.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { basename, clip, globDir, isDir, mtimeSec, oneLine, readText, redact } from './util.mjs';

const EVENTS_KEEP = 40;

// Aksi Codex → teks singkat (gaya sama dengan describeTool Claude)
export function describeCodex(name, raw) {
  const s = typeof raw === 'string' ? raw : '';
  if (name === 'apply_patch' || s.includes('apply_patch')) return 'Mengubah file';
  const m = /cmd\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(s) ?? /"(?:cmd|command)"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(s);
  if (m) {
    const w = m[1].trim().split(/\s+/)[0] || '';
    return oneLine(w.startsWith('$') || w === '' ? 'Menjalankan skrip' : `Menjalankan: ${w.slice(0, 30)} …`, 160);
  }
  return oneLine(clip(name || 'alat', 60), 160);
}

export function summarizeCodex(text, file) {
  const run = {
    provider: 'codex', agentType: 'Codex', description: '', parentAgent: null, id: '', session: '',
    started: null, updated: null, tools: 0, tokens: 0, events: [], lastKind: null, limit: null, files: [], segs: [], stops: [],
  };
  let cwd = '';
  for (const line of text.split('\n')) {
    if (line === '') continue;
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      continue; // baris terpotong (awal ekor atau sedang ditulis)
    }
    const t = typeof r.timestamp === 'string' ? r.timestamp : '';
    const p = r.payload && typeof r.payload === 'object' ? r.payload : {};
    if (t !== '') {
      if (run.started === null) run.started = t;
      run.updated = t;
    }
    if (r.type === 'session_meta') {
      run.session = String(p.id ?? '');
      run.id = `codex-${run.session.slice(0, 12)}`;
      cwd = typeof p.cwd === 'string' ? p.cwd : '';
    } else if (r.type === 'event_msg' && p.type === 'task_started') {
      const last = run.segs[run.segs.length - 1];
      if (!last || last[1] !== null) run.segs.push([t, null]);
      run.lastKind = 'user';
    } else if (r.type === 'event_msg' && p.type === 'task_complete') {
      const last = run.segs[run.segs.length - 1];
      if (last && last[1] === null) last[1] = t;
      run.lastKind = 'handback';
    } else if (r.type === 'event_msg' && p.type === 'token_count') {
      const n = p.info?.total_token_usage?.total_tokens;
      if (Number.isFinite(n)) run.tokens = n;
    } else if (r.type === 'response_item' && (p.type === 'custom_tool_call' || p.type === 'function_call')) {
      const txt = describeCodex(String(p.name ?? ''), p.input ?? p.arguments);
      run.tools++;
      run.lastKind = 'tool';
      run.description = txt;
      run.events.push({ t, kind: 'tool', text: redact(txt), tool: String(p.name ?? '') || null });
      if (run.events.length > EVENTS_KEEP) run.events.shift();
    }
  }
  if (run.id === '') run.id = `codex-${basename(file, '.jsonl').slice(-12)}`;
  if (run.description === '') run.description = `Sesi Codex${cwd ? ` · ${basename(cwd.replace(/\\/g, '/'))}` : ''}`;
  return run;
}

const TAIL_MAX = 3 * 1024 * 1024; // berkas lebih besar: hanya ekor terakhir
const FILES_PER_SCAN = 20;
const memo = new Map(); // berkas → {size, mtimeMs, run}: tidak parse ulang bila berkas tidak berubah

function readTail(file, size) {
  if (size <= TAIL_MAX) return readText(file) ?? '';
  const fd = fs.openSync(file, 'r');
  try {
    const b = Buffer.alloc(TAIL_MAX);
    fs.readSync(fd, b, 0, TAIL_MAX, size - TAIL_MAX);
    const s = b.toString('utf8');
    return s.slice(s.indexOf('\n') + 1); // buang baris pertama yang terpotong
  } finally {
    fs.closeSync(fd);
  }
}

// Semua sesi Codex dalam window_days (tidak difilter per project: Codex sering dibuka di folder lain).
export function scanCodex(nowSec, cfg, home = os.homedir()) {
  const root = path.join(process.env.CODEX_HOME || path.join(home, '.codex'), 'sessions');
  if (!isDir(root)) return [];
  const cutoff = nowSec - cfg.window_days * 86400;
  const files = [];
  for (const y of globDir(root, '')) for (const m of globDir(y, '')) for (const d of globDir(m, '')) {
    for (const f of globDir(d, '.jsonl')) if (mtimeSec(f) >= cutoff) files.push([f, mtimeSec(f)]);
  }
  files.sort((a, b) => b[1] - a[1]);
  const runs = [];
  for (const [f] of files.slice(0, FILES_PER_SCAN)) {
    let st;
    try {
      st = fs.statSync(f);
    } catch {
      continue;
    }
    let hit = memo.get(f);
    if (!hit || hit.size !== st.size || hit.mtimeMs !== st.mtimeMs) {
      hit = { size: st.size, mtimeMs: st.mtimeMs, run: summarizeCodex(readTail(f, st.size), f) };
      memo.set(f, hit);
    }
    if (hit.run.started !== null && hit.run.segs.length) runs.push({ ...hit.run });
  }
  return runs;
}
