# Claims in documents

Every sentence in this repo's documentation that asserts a capability — **and every sentence that
denies one** — must name the tree it was checked against, and the check must have been a reading.

## Why a grep cannot do this

A scan built to catch over-claiming finds *promises the app cannot keep*. A denial contains no
promise. `There is no service worker` has nothing for such a scan to flag, so the line never gets a
vote — and a scan that excludes false claims is satisfied by every false denial.

This is not hypothetical here. `README.md`'s "What this README does not claim" section spent a phase
denying a service worker, a web-app manifest and an installable app, ten lines above a `public/sw.js`
and a `public/manifest.webmanifest`. The acceptance row meant to catch that — *"the grep returns only
lines that explicitly deny the claim"* — **passed on the paragraph in which every one of those words
was false.** The row could not fail, which is the same thing as saying it could not pass. It was
deleted rather than re-worded (`docs/ROADMAP.md`, *"a denial is a claim too"*).

The same row then went wrong in the other direction: once the README was corrected, the section
*describing* the service worker used the same words the denial had, so no honest document could
satisfy it. **A grep matches words; a claim is a sentence about a build.**

## What to do instead

- **Read the sentence, then read the tree.** A claim is verified by opening the file it describes,
  not by matching its vocabulary. When a sentence names a path, a size, a count or a line range, that
  is the thing to check.
- **Read denials as claims about the build.** A denial is the sentence a newcomer is most likely to
  act on, so it is the one that costs the most when it is wrong.
- **Say what it was checked against.** "No request leaves the origin" is a claim; "no request leaves
  the origin (`grep -rn 'fetch(' src/` → no matches)" is a check someone else can repeat.
- **Prefer a runtime guard where one exists.** A test that pins the exact sentence cannot be
  satisfied by a reworded one. `e2e/tests/landing/landing.spec.ts` asserts the Landing Page's trust
  rows whole, scoped text rather than keywords, for precisely this reason. A grep only notices when a
  word stops appearing; an assertion notices when the meaning changes.

## Scope

This applies to every document that describes what ships: `README.md`, `PRODUCT.md`, the Landing
Page copy, ADRs, and any ticket whose acceptance test is a claim about the tree. It is why several
tickets in `.scratch/` carry a `## Comments` reading rather than a checkbox.

Nothing mechanical enforces this, and nothing can. It is a reading.
