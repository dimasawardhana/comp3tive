# 08: Import survives a bad file

**Status:** resolved

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

## Comments

Resolved by commit `3a85f65` ("fix: import survives a bad file"), through three review rounds: `2a9e940`, `d8b1085`, `dc5ee52` ("fix: an unclosed quote costs its own line, not the rest of the file"), and `f38ed34` ("fix: stop refusing the shipped sample, and stop reporting an empty import").

`src/data/player-import.ts` exports exactly the six contracted names (`MAX_IMPORT_BYTES:4`, `CsvRow:14`, `ImportSkip:22`, `assertImportSize:28`, `parsePlayerCsv:111`, `csvRowsToPlayers:184`). The size guard runs before the file is read (`src/App.tsx:536-537`), an unknown discipline lands in `skipped` rather than importing a capability-less player (`src/data/player-import.ts:196`), and no `alert(` survives in either import branch.

The replacement code for a silent-data-loss defect twice introduced another silent-data-loss defect of the same class, and each was caught only because a test asserted the *absence* of a bad outcome. The shipped rule: a quote that opened at the start of a field means multi-line intent, so its continuation is consumed and never re-read as its own record; a quote opened mid-token is a typo on that line alone, so the next line is read afresh. `MAX_RECORD_LINES = 2` bounds it, and a 500-row roster with one stray quote at row 5 now imports 499 and reports one skip.

Two deviations from this ticket's own acceptance boxes, both deliberate. (1) It asked for a single summary line naming the imported count and the first skipped line; the code emits two — the count on the success channel and the skip on the error channel (`src/App.tsx:620-632`). That is a review finding, not drift: the original pairing fired the success toast unconditionally, so an import that rejected every row reported "Imported 0 players" in success styling, and `f38ed34` guards the success toast on a non-zero count. (2) It asserted the existing imports still behave as before; `src/data/sample-roundtrip.test.ts` now pins that directly, parsing both shipped files through `parseBackup(..., SEED_DISCIPLINES)` at 25 players each with every player passing `validatePlayer` — the round trip `DisciplinesScreen`'s own "Sample" button advertises.
