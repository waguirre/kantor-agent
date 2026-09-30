#!/usr/bin/env node
// Fork: emisor de hook para agy (Antigravity CLI). Uso: node agy-emit.mjs pre|post|stop
// Lee el JSON del hook por stdin, agrega UNA línea mínima a events.jsonl y responde "{}" (sin decisión:
// nunca aprueba ni bloquea nada). Guarda sólo nombre de alat + aksi singkat, jamás el contenido de tool_input.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const phase = process.argv[2] || 'post';
const dir = process.env.KANTOR_PROVIDERS_DIR || path.join(os.homedir(), '.cache', 'kantor-agent', 'providers', 'agy');

let raw = '';
try {
  raw = fs.readFileSync(0, 'utf8');
} catch {
  // sin stdin: aun así responder
}
try {
  const j = JSON.parse(raw || '{}');
  const pick = (...ks) => ks.map((k) => j[k]).find((v) => typeof v === 'string' && v !== '') ?? '';
  const inp = j.tool_input ?? j.toolInput ?? j.input ?? {};
  const cmd = typeof inp === 'object' && inp ? String(inp.command ?? inp.cmd ?? '') : '';
  const rec = {
    t: new Date().toISOString(),
    session: pick('session_id', 'sessionId', 'conversation_id', 'conversationId', 'trajectory_id') || 'agy',
    phase,
    tool: pick('tool_name', 'toolName', 'tool'),
    cmd: cmd.trim().split(/\s+/)[0]?.slice(0, 30) ?? '',
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'events.jsonl'), `${JSON.stringify(rec)}\n`);
  // Sólo nombres de campos (no valores) para verificar el contrato del hook en el primer uso real.
  fs.writeFileSync(path.join(dir, 'last-payload-keys.json'), JSON.stringify({ t: rec.t, phase, keys: Object.keys(j) }));
} catch {
  // el emisor jamás debe romper agy
}
process.stdout.write('{}\n');
