---
tags: reference, claude-config
---

# CLAUDE.local.md — kantor-agent

> Config personal de este scope (**raiz**). Copia sincronizada en el vault
> (`02-projects/Kantor-Agent/claude-local/main/`), bidireccional en cada
> SessionStart. Una nota por proyecto, worktree y subcontexto.
> NO versionar: el equipo no usa Obsidian, graphify ni serena.
> Excluido via `.git/info/exclude`, sin tocar el `.gitignore` compartido.
> Proyecto: [[Kantor-Agent]]

## Obsidian
- Vault: `~\.dev\obsidian\claude` (o `$env:CLAUDE_VAULT`)
- Conocimiento: `02-projects/Kantor-Agent/_knowledge/` (`20-rules/`, `21-decisions/`, `22-patterns/`, `23-maps/`)
- Planes: `02-projects/Kantor-Agent/plans/` — nunca `.md` de planes dentro de este repo.
- Estado: `02-projects/Kantor-Agent/STATE.md` (skills `inicio-sesion` / `fin-sesion` / `actualizar-estado`).
- Notas de sesion organizadas por rama de git.

## graphify
- Grafo de este scope: `02-projects/Kantor-Agent/graphify/main/graph.json`
- Navegar: `node <claude-sync>/claude-scripts/graphify-nav.mjs "<termino>" --limit 20`
- Antes de grep masivo o de listar arboles grandes, consultar el grafo.
- Actualizar: `graphify update .` (incremental) | `graphify . --code-only` (rebuild).
- Monorepo: un grafo por subcontexto (`{sub}/graphify-out/`), sin grafo raiz.

## serena
- Proyecto registrado en `~/.serena/serena_config.yml`; MCP compartido en `http://127.0.0.1:9121/mcp`.
- Usar `find_symbol` / `find_referencing_symbols` antes que lecturas completas de archivos.

## Reglas de contexto
- Analisis, parsing y busquedas amplias: `ctx_batch_execute` / `ctx_execute` / `ctx_search`.
- Archivos no-texto (PDF/Word/Excel/PPT): `markitdown <archivo> > <archivo>.md` antes de leer.
- Sin `curl`/`wget`, sin lecturas completas de archivos grandes, sin salidas de shell > 20 lineas.
