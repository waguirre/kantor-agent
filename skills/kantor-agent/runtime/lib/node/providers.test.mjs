// Verificación mínima de los lectores Codex/agy del fork: node lib/node/providers.test.mjs
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { summarizeCodex } from './codex.mjs';
import { summarizeAgy } from './agy.mjs';

const T = '2026-09-30T00:00:0';
const codex = [
  { timestamp: `${T}0Z`, type: 'session_meta', payload: { id: 'abc123def4567', cwd: 'C:/x/proj' } },
  { timestamp: `${T}1Z`, type: 'event_msg', payload: { type: 'task_started' } },
  { timestamp: `${T}2Z`, type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', input: 'tools.exec_command({cmd:"git status"})' } },
  { timestamp: `${T}3Z`, type: 'event_msg', payload: { type: 'task_complete' } },
].map((r) => JSON.stringify(r)).join('\n');
const r = summarizeCodex(codex, 'x.jsonl');
assert.equal(r.provider, 'codex');
assert.equal(r.id, 'codex-abc123def456');
assert.equal(r.description, 'Menjalankan: git …');
assert.deepEqual(r.segs, [[`${T}1Z`, `${T}3Z`]]);
assert.equal(r.lastKind, 'handback');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-'));
const emit = path.join(import.meta.dirname, '..', '..', 'bin', 'agy-emit.mjs');
const env = { ...process.env, KANTOR_PROVIDERS_DIR: dir };
const out = execFileSync('node', [emit, 'pre'], { input: '{"session_id":"s1","tool_name":"run_command","tool_input":{"command":"npm test"}}', env }).toString();
assert.equal(out.trim(), '{}'); // el emisor nunca decide nada
execFileSync('node', [emit, 'stop'], { input: '{"session_id":"s1"}', env });
const [a] = summarizeAgy(fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8'));
assert.equal(a.provider, 'agy');
assert.equal(a.description, 'Menjalankan: npm …');
assert.equal(a.segs.length, 1);
assert.notEqual(a.segs[0][1], null);
assert.ok(!fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').includes('npm test')); // sólo 1er token
console.log('providers OK');
