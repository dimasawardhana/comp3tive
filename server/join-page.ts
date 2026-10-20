/**
 * The public registration page at `/join/:code` (TASK-125).
 *
 * Served by the Worker as one self-contained HTML document: no React, no app
 * bundle, no account. That is a load-bearing choice, not a shortcut — the
 * app's invariants are "no screen awaits a fetch on mount" and "a Guest's app
 * never opens a connection at render", and this page is neither the app nor a
 * screen: it is a plain document whose only behaviour is a form POST.
 *
 * Everything on the page is inline (styles in <style>, no external asset) so
 * the document is byte-identical for every community and cacheable forever;
 * the community's name and its discipline catalog are fetched by the page's
 * own script from `/api/join/:code`, which is the only request it makes
 * before the visitor acts.
 */

const PAGE_CSS = `
:root {
  color-scheme: light dark;
  --surface: #faf8f5;
  --ink: #1c1917;
  --accent: #c2410c;
  --muted: #78716c;
  --rule: #e7e0d8;
  --card: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root {
    --surface: #1c1917;
    --ink: #faf8f5;
    --accent: #ea580c;
    --muted: #a8a29e;
    --rule: #3b342f;
    --card: #262220;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Familjen Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--surface);
  color: var(--ink);
  line-height: 1.5;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 2rem 1rem;
}
main { width: 100%; max-width: 26rem; }
h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
p.sub { color: var(--muted); margin: 0 0 1.5rem; }
label { display: block; font-weight: 600; margin: 1rem 0 .25rem; }
select, input, textarea {
  width: 100%;
  font: inherit;
  color: inherit;
  background: var(--card);
  border: 1px solid var(--rule);
  border-radius: 8px;
  padding: .5rem .75rem;
}
textarea { min-height: 4.5rem; resize: vertical; }
button {
  font: inherit;
  font-weight: 600;
  color: var(--surface);
  background: var(--accent);
  border: 0;
  border-radius: 8px;
  padding: .65rem 1.25rem;
  margin-top: 1.5rem;
  width: 100%;
  cursor: pointer;
}
button:disabled { opacity: .6; cursor: default; }
p.note { font-size: .875rem; color: var(--muted); margin: .25rem 0 0; }
p.error { color: var(--accent); font-weight: 600; margin: 1rem 0 0; }
p.done { font-weight: 600; margin: 1rem 0 0; }
`;

/** The form document. `code` is already validated as the URL's code segment. */
export function joinPage(code: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex" />
<title>Register as a player</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<main>
  <h1 id="title">Register as a player</h1>
  <p class="sub" id="sub">Loading the community's form…</p>
  <form id="form" hidden>
    <label for="name">Your name</label>
    <input id="name" name="name" required maxlength="80" autocomplete="name" />
    <label for="discipline">Discipline</label>
    <select id="discipline" name="discipline" required></select>
    <label for="role">Preferred role</label>
    <select id="role" name="role"></select>
    <p class="note">Optional: leave blank if any role suits you.</p>
    <label for="notes">Notes for the organizer</label>
    <textarea id="notes" name="notes" maxlength="500"></textarea>
    <button type="submit" id="submit">Register</button>
    <p class="error" id="error" hidden></p>
    <p class="done" id="done" hidden></p>
  </form>
</main>
<script>
(async () => {
  const code = ${JSON.stringify(code)};
  const $ = (id) => document.getElementById(id);
  const error = $("error"), done = $("done");
  const fail = (msg) => { error.textContent = msg; error.hidden = false; $("sub").textContent = ""; };
  let disciplines;
  try {
    const response = await fetch("/api/join/" + encodeURIComponent(code));
    if (!response.ok) {
      fail(response.status === 404 ? "That join code does not exist. Check the link with the organizer."
                                    : "The form could not be loaded. Try again in a moment.");
      return;
    }
    const data = await response.json();
    $("title").textContent = "Join " + data.community.name;
    $("sub").textContent = "Register as a player and the organizer will add you to the roster.";
    const discipline = $("discipline"), role = $("role");
    // Two disciplines can share a name (the seed Futsal and an adopted
    // document's own Futsal). The picker offers the name once, with the
    // roles of every same-named entry merged, so the visitor never sees a
    // duplicate option whose roles silently depend on which copy the
    // browser happened to keep.
    const byName = new Map();
    for (const d of data.disciplines) {
      if (!byName.has(d.name)) {
        byName.set(d.name, { name: d.name, roles: [] });
        const option = document.createElement("option");
        option.value = d.name;
        option.textContent = d.name;
        discipline.appendChild(option);
      }
      byName.get(d.name).roles.push(...d.roles);
    }
    const fillRoles = () => {
      role.replaceChildren();
      const blank = document.createElement("option");
      blank.value = ""; blank.textContent = "Any role";
      role.appendChild(blank);
      const d = byName.get(discipline.value);
      const seen = new Set();
      for (const name of d ? d.roles : []) {
        if (seen.has(name)) continue;
        seen.add(name);
        const option = document.createElement("option");
        option.value = name; option.textContent = name;
        role.appendChild(option);
      }
    };
    discipline.addEventListener("change", fillRoles);
    fillRoles();
    $("form").hidden = false;
    $("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true; done.hidden = true;
      const submit = $("submit");
      submit.disabled = true;
      try {
        const response = await fetch("/api/join/" + encodeURIComponent(code), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: $("name").value,
            discipline: discipline.value,
            role: role.value,
            notes: $("notes").value,
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          fail(body.error || "The registration could not be sent. Try again.");
          submit.disabled = false;
          return;
        }
        $("form").replaceChildren();
        $("title").textContent = "You are registered";
        $("sub").textContent = "";
        done.textContent = "The organizer has your registration. They will add you to the roster.";
        done.hidden = false;
      } catch {
        fail("The registration could not be sent. Check your connection and try again.");
        submit.disabled = false;
      }
    });
  } catch {
    fail("The form could not be loaded. Check your connection and try again.");
  }
})();
</script>
</body>
</html>`;
}
