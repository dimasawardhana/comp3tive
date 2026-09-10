# Discipline Sample Data Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every discipline downloadable with its own sample-data roster file from the FE side, and enforce that creating a discipline requires creating its sample data.

**Architecture:** Sample data files live in `sample-data/` as JSON backups (v1 format like `mpl-id-roster.json`). A new `sample-data.ts` module maps discipline IDs to their sample files and provides a download helper. The DisciplinesScreen gets a download button per discipline. A validation rule in the discipline save flow enforces the sample-data requirement.

**Tech Stack:** TypeScript, React, IndexedDB, Vite, Vitest

**Spec:** `sample-data/mpl-id-roster.json` (existing MLBB sample), `src/data/transfer.ts` (backup format), `src/domain/seed.ts` (discipline definitions), `src/domain/useDisciplines.ts` (discipline CRUD)

---

## Global Constraints

- Sample data JSON files must use version 1 backup format (as in `mpl-id-roster.json`)
- All sample data must have players with `capabilities[].disciplineId` matching the discipline
- Built-in disciplines (futsal, mlbb) ship with sample data; custom disciplines require sample data at creation time
- Download uses `Blob` + `URL.createObjectURL` + `<a>` click pattern (same as `handleExport`)
- File naming convention: `{disciplineId}-roster.json`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `sample-data/futsal-roster.json` | Sample roster for Futsal (25 players, v1 backup format) |
| Create | `src/data/sample-data.ts` | Sample data registry and download helper |
| Modify | `src/domain/useDisciplines.ts` | Add validation: discipline requires sample data |
| Modify | `src/domain/DisciplinesScreen.tsx` | Add download button per discipline |
| Modify | `src/App.tsx` | Add `downloadSampleData` function and pass to DisciplinesScreen |
| Modify | `src/data/transfer.ts` | Add `isBackupData` validation export |
| Test | `src/data/sample-data.test.ts` | Tests for sample data registry and download |

---

### Task 1: Create Futsal sample data file

**Files:**
- Create: `sample-data/futsal-roster.json`

Create a Futsal sample roster following the exact format of `sample-data/mpl-id-roster.json`. It must:
- Have `version: 1`
- Have `exportedAt` timestamp
- Have 25 players (matching the MLBB count) with `capabilities[].disciplineId: "futsal"`
- Use Futsal roles: goalkeeper, defender, winger, pivot
- Use Futsal attributes: technical, fitness, game-iq
- Have empty `sessions: []`

Copy the structure from `mpl-id-roster.json` but change every `disciplineId: "mlbb"` to `disciplineId: "futsal"` and adjust role names/attribute names to match Futsal's schema.

- [ ] Create `sample-data/futsal-roster.json` with 25 futsal players
- [ ] Verify JSON is valid: `node -e "JSON.parse(require('fs').readFileSync('sample-data/futsal-roster.json'))"`

---

### Task 2: Create sample-data registry module

**Files:**
- Create: `src/data/sample-data.ts`
- Test: `src/data/sample-data.test.ts`

Create a module that:
1. Exports a `SAMPLE_DATA` record mapping discipline IDs to their sample file metadata
2. Provides a `getSampleDataUrl(disciplineId: string): string | null` function that creates a Blob URL for download
3. Provides a `downloadSampleData(disciplineId: string): void` function that triggers a browser download
4. Provides a `hasSampleData(disciplineId: string): boolean` function
5. Provides a `listDisciplinesWithSampleData(): string[]` function

The module should:
- Import JSON files as raw strings using Vite's `?raw` import
- Cache Blob URLs to avoid creating new ones on every call
- Use the same download pattern as `handleExport` in App.tsx

```ts
// src/data/sample-data.ts
import mplRoster from "../sample-data/mpl-id-roster.json";
import futsalRoster from "../sample-data/futsal-roster.json";

export interface SampleDataInfo {
  disciplineId: string;
  fileName: string;
  playerCount: number;
}

const SAMPLE_DATA: Record<string, string> = {
  mlbb: mplRoster as string,
  futsal: futsalRoster as string,
};

export function getSampleDataUrl(disciplineId: string): string | null { ... }
export function downloadSampleData(disciplineId: string): void { ... }
export function hasSampleData(disciplineId: string): boolean { ... }
export function listDisciplinesWithSampleData(): string[] { ... }
export function getSampleDataInfo(disciplineId: string): SampleDataInfo | null { ... }
```

- [ ] Create `src/data/sample-data.ts` with all exported functions
- [ ] Create `src/data/sample-data.test.ts` testing: `hasSampleData("mlbb")` returns true, `hasSampleData("futsal")` returns true, `hasSampleData("unknown")` returns false, `downloadSampleData` creates a Blob URL

---

### Task 3: Add download button to DisciplinesScreen

**Files:**
- Modify: `src/domain/DisciplinesScreen.tsx`
- Modify: `src/App.tsx`

The DisciplinesScreen needs a download button next to each discipline row.

**Step 1:** Update `DisciplinesScreen.Props` to accept:
- `onDownloadSample?: (disciplineId: Id) => void`
- `downloadingId?: string | null` (to show loading state)

**Step 2:** Add a download button to each discipline list item. The button should:
- Be a `btn btn-ghost` styled button
- Show a download icon (⬇ or ⤓)
- Call `onDownloadSample(discipline.id)` on click
- Stop propagation to avoid triggering row click

**Step 3:** In App.tsx, create the `downloadSampleData` function:
```ts
const downloadSampleData = async (disciplineId: Id) => {
  const { downloadSampleData: download } = await import("../data/sample-data");
  download(disciplineId);
};
```
Pass it as `onDownloadSample` to `DisciplinesScreen`.

- [ ] Add `onDownloadSample` and `downloadingId` props to DisciplinesScreen
- [ ] Add download button to each discipline row
- [ ] Add `downloadSampleData` function in App.tsx
- [ ] Wire `onDownloadSample` to DisciplinesScreen in App.tsx
- [ ] Verify type-check passes

---

### Task 4: Enforce sample-data requirement when creating disciplines

**Files:**
- Modify: `src/domain/useDisciplines.ts`
- Modify: `src/domain/DisciplinesScreen.tsx`
- Modify: `src/App.tsx`

Add a rule: **a discipline cannot be saved unless sample data exists for it.** This means when a user creates a custom discipline, they must also provide sample data.

**Step 1:** Update `useDisciplines.saveDiscipline` to validate:
- If the discipline is NOT built-in (`!discipline.builtIn`), check that sample data exists for it
- If sample data doesn't exist, throw an error: `"Sample data is required for custom disciplines"`
- The check should call `hasSampleData(discipline.id)` from the sample-data module

**Step 2:** Update `DisciplinesScreen` to show an error if a custom discipline is saved without sample data. When the `saveDiscipline` throws, the modal should show the error message.

**Step 3:** In `DisciplineEditModal`, add validation that prevents saving a custom discipline without sample data being uploaded. The modal should:
- Show a file input for uploading sample data JSON when creating a new discipline
- Validate the uploaded file is valid JSON with a `players` array
- Store the uploaded JSON text
- Pass it to `saveDiscipline` so it can be registered

Actually, a simpler approach: the validation happens at the `saveDiscipline` level. If a custom discipline has no sample data, the save fails. The user must first download/upload sample data before creating a discipline. But this is awkward UX.

**Better approach:** When creating a new discipline, automatically generate a minimal sample data file. The `DisciplineEditModal` should:
- After saving a new discipline, prompt the user to add sample data
- Provide a "Download Sample Data Template" button that downloads a minimal template

But the simplest rule that satisfies "if every discipline is created, a sample data need to be created too":

**Step 1 (simple):** When `saveDiscipline` is called for a non-built-in discipline, require that sample data exists. If it doesn't exist, throw an error. This means the user must create sample data first (via download template + upload).

**Step 2:** Add a `sampleDataText` parameter to `saveDiscipline` or a separate `saveSampleData` function.

Actually, the simplest approach that matches the constraint:

**When a non-built-in discipline is saved, check that `hasSampleData(discipline.id)` is true. If false, throw.** The `DisciplineEditModal` needs a file upload for sample data.

**Step 3:** Modify `DisciplineEditModal` Props to accept `onSampleDataUpload?: (disciplineId: Id, json: string) => void`. The modal shows a file upload when editing a new discipline.

- [ ] Update `useDisciplines.saveDiscipline` to validate sample data requirement for non-built-in disciplines
- [ ] Add `onSampleDataUpload` prop to `DisciplineEditModal`
- [ ] Add file upload UI to `DisciplineEditModal` for new disciplines
- [ ] Wire upload flow in `App.tsx` and `DisciplinesScreen`
- [ ] Verify type-check passes

---

### Task 5: Add import validation for sample data

**Files:**
- Modify: `src/data/transfer.ts`
- Test: `src/data/transfer.test.ts`

Add a `validateSampleData` function to `transfer.ts`:
- Checks that a backup JSON has a `players` array
- Each player has `capabilities` with matching `disciplineId`
- Returns the discipline ID found in the file
- Used during import to auto-detect which discipline the sample data belongs to

- [ ] Add `detectDisciplineFromSampleData(text: string): string | null` to `src/data/transfer.ts`
- [ ] Add tests for the function
- [ ] Verify type-check passes

---

### Task 6: Full integration test and verification

**Files:**
- Test: `src/data/sample-data.test.ts` (integration tests)

Run end-to-end verification:
1. Navigate to DisciplinesScreen
2. Verify MLBB and Futsal both show download buttons
3. Click download for MLBB → verify JSON file downloads with correct content
4. Click download for Futsal → verify JSON file downloads with correct content
5. Verify custom discipline creation requires sample data
6. Run full test suite

- [ ] Run `npm test` — all tests pass
- [ ] Run `npx tsc --noEmit` — no type errors
- [ ] Run `npx vite build` — builds successfully
- [ ] Manually verify download in browser

---

### Task 7: Commit

- [ ] `git add` all changed files
- [ ] `git commit -m "feat: add per-discipline sample data download with validation rule"`
