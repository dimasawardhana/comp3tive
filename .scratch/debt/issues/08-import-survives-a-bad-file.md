# 08: Import survives a bad file

**Status:** ready-for-agent

**What to build:** The import path tells the truth about what it did. A quoted CSV field imports as one value, a discipline it does not recognise is reported by row rather than silently producing a player who cannot play anything, and a file too large to be sensible is refused before it is read into memory.

**Evidence (absorbed from `.scratch/app-health/issues/11`).** Three separate failures in one function.

- **The CSV parser is positional and naive.** `src/App.tsx:574-582` splits on `,`, strips leading/trailing quotes and takes columns by index:

  ```ts
  const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
  const name = parts[0];
  const disciplineShort = parts[1]?.toLowerCase() || "";
  const strength = parts[2] ? Number(parts[2]) : 3;
  ```

  A quoted field containing a comma — `"Smith, John", futsal, 4` — splits into four parts and imports the name as `Smith`. No error surfaces.
- **An unmatched discipline is silent.** `matchedDiscipline` comes back `undefined`, `capability` is `null` (`:598`), and the player is saved with `capabilities: []` (`:603`). The import reports success; the player cannot be selected for any split.
- **Unbounded read.** The whole file is read with `await file.text()` (`:519`) before anything checks its size.

**Acceptance criteria:**
- [ ] New pure module `src/data/player-import.ts` exports exactly: `MAX_IMPORT_BYTES = 5 * 1024 * 1024`; `CsvRow { line, name, discipline, strength }`; `ImportSkip { line, reason }`; `assertImportSize(bytes): void`; `parsePlayerCsv(text): { rows, skipped }`; `csvRowsToPlayers(rows, disciplines, communityId): { players, skipped }`
- [ ] `parsePlayerCsv` implements a small quoted-field state machine: `"` toggles in-quote, `""` inside quotes is a literal quote, a comma inside quotes is data — so `"Smith, John", futsal, 4` imports the name `Smith, John`
- [ ] The header-row heuristic (`lines[0].toLowerCase().includes("name")`, `:575`) moves inside the parser and applies to the parsed first row, so a quoted header still skips
- [ ] A row with fewer than three fields is skipped with its 1-based line number and a reason — never silently defaulted
- [ ] `csvRowsToPlayers` resolves each row's discipline against the catalog; a row that matches nothing goes to `skipped` with its line number and the discipline as typed, never to a player with `capabilities: []`
- [ ] `assertImportSize(file.size)` runs at the top of `handlePlayerImport` (`src/App.tsx:515-520`), **before** `await file.text()` (`:519`), and throws `Import refused: this file is 12.4 MB; the limit is 5 MB.` on an oversize file
- [ ] The CSV branch calls the module and reports one summary line through the existing `notify(…, "error")` toast (`src/App.tsx:163-171`, `.toast-container` at `:1257`), naming the imported count and the first skipped line with its reason
- [ ] The seven `alert()` calls in these two import branches are replaced by `notify`; alerts elsewhere in `src/App.tsx` are untouched (Phase C27 owns those)
- [ ] Existing imports still work: `sample-data/*.json` (v1 backups, 25 players each), the players-only JSON path, and a clean CSV import behave exactly as they do today
- [ ] No new dependency is added — a small state machine, not a CSV library (ADR-0001's client-only stance and the two-dependency `package.json` are load-bearing)
- [ ] New `src/data/player-import.test.ts` covers: a quoted field with and without an embedded comma, an escaped `""`, a quoted header skipped, a too-short row skipped by line number, an unknown discipline reported by name and line, a valid file parsing cleanly, and `assertImportSize(6 * 1024 * 1024)` refusing with the limit in the message

**Blocked by:** 01 — the parser module is independent, but the seeded helper is needed by the specs that exercise import end to end

**Design reference:** `.scratch/app-correctness/issues/03` establishes the message tone for rejected imports — specific and user-readable, naming the offending record. Match it.

**Notes:** The size limit is a guard against a self-inflicted freeze, not a security control. Five megabytes is generous for a real roster. The interface above is frozen: Phase D36 consumes it verbatim and owns discovery (a CSV template, in-app column documentation) and bulk rating — not parsing, validation or messages.
