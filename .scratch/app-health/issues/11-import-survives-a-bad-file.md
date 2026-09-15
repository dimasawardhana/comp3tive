# 11 — Import survives a bad file

**What to build:** The import path tells the truth about what it did. A quoted CSV field imports as
one value, a discipline it does not recognise is reported rather than silently producing a player
who cannot play anything, and a file too large to be sensible is refused before it is read into
memory.

**Evidence.** Three separate failures in the same function:

- **The CSV parser is positional and naive.** It splits on `,`, strips leading/trailing quotes, and
  takes columns by index. A quoted field containing a comma — `"Smith, John", futsal, 4` — splits
  into four parts and imports the name as `Smith`. There is no error; there is a player called
  `Smith`.
- **An unmatched discipline is silent.** `matchedDiscipline` comes back `undefined`, the capability
  is `null`, and the player is saved with `capabilities: []`. The import reports success. The player
  cannot be selected for any split, and nothing said so.
- **Unbounded read.** The whole file is read with `await file.text()` and parsed synchronously, then
  written record by record in a loop. A multi-hundred-megabyte JSON freezes the tab with no message
  and no way to cancel.

**Blocked by:** 10 — same function, and 10 replaces the `alert()` calls this ticket's messages go
through.

**Status:** ready-for-agent

- [ ] A CSV field wrapped in quotes, with or without an embedded comma, imports as a single value
- [ ] A CSV row naming a discipline that does not exist is reported by name — the user learns which
      row and which discipline, not just that something went wrong
- [ ] The header-row heuristic (skip the first line when it contains "name") still holds, including
      for a quoted header
- [ ] A file above a stated size limit is refused with a message naming the limit, **before** its
      contents are read
- [ ] A player with no capabilities is a deliberate outcome the user was told about, never a quiet
      one
- [ ] Existing imports still work: `sample-data/*.json` (v1 backups, 25 players each) and the
      players-only and CSV paths behave exactly as they do today
- [ ] Tests cover the quoted field, the unknown discipline, and the size refusal

**Design reference:** `.scratch/app-correctness/03` establishes the message *tone* for rejected
imports — specific and user-readable, naming the offending record. Match it.

**Notes:** A proper CSV parser is not required; a small quoted-field state machine is enough and
keeps the zero-dependency posture. Do not reach for a library — ADR-0001's client-only stance and
the two-dependency `package.json` are load-bearing parts of this project's identity.

The size limit is a guard against a self-inflicted freeze, not a security control. Pick a number
that is generous for a real roster (a few MB) and state it in the message.
