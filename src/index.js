const COOKIE_NAME = "mlr_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

function pinPage(error = false) {
  const message = error ? '<p class="error" role="alert">Incorrect PIN</p>' : "";
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b0f14">
  <title>Market Level Radar · Sign in</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; color: #e8edf4; background: radial-gradient(circle at top, #16202c 0, #0b0f14 48%, #070a0e 100%); }
    main { width: min(100%, 420px); padding: 32px; border: 1px solid #273443; border-radius: 16px; background: rgba(15, 21, 29, .96); box-shadow: 0 24px 70px rgba(0, 0, 0, .42); }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
    .mark { display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid #58a6ff; border-radius: 10px; color: #8bc2ff; font-weight: 800; letter-spacing: .04em; }
    h1 { margin: 0; font-size: 1.25rem; }
    .eyebrow { margin-top: 3px; color: #7f8d9d; font-size: .72rem; font-weight: 700; letter-spacing: .14em; }
    h2 { margin: 0 0 8px; font-size: 1.55rem; }
    .muted { margin: 0 0 24px; color: #98a6b6; line-height: 1.55; }
    label { display: block; margin-bottom: 8px; color: #b7c2cf; font-size: .82rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    input { width: 100%; padding: 13px 14px; border: 1px solid #334456; border-radius: 9px; outline: none; background: #0a1017; color: #fff; font: inherit; }
    input:focus { border-color: #58a6ff; box-shadow: 0 0 0 3px rgba(88, 166, 255, .14); }
    button { width: 100%; margin-top: 14px; padding: 13px 16px; border: 0; border-radius: 9px; background: #2f81f7; color: #fff; font: inherit; font-weight: 750; cursor: pointer; }
    button:hover { background: #438ff8; }
    .error { margin: 0 0 14px; color: #ff7b72; font-weight: 650; }
  </style>
</head>
<body>
  <main>
    <div class="brand"><div class="mark">ML</div><div><h1>Market Level Radar</h1><div class="eyebrow">PRIVATE DASHBOARD</div></div></div>
    <h2>Enter access PIN</h2>
    <p class="muted">Enter your PIN to continue to the dashboard.</p>
    ${message}
    <form method="post" action="/__auth">
      <label for="pin">PIN</label>
      <input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required autofocus>
      <button type="submit">Continue</button>
    </form>
  </main>
</body>
</html>`, {
    status: error ? 401 : 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function authToken(pin) {
  const bytes = await digest(`market-level-radar:${pin}`);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request) {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function cleanSharedState(value) {
  const interested = Array.isArray(value?.interested)
    ? [...new Set(value.interested.map(String).map(s => s.trim().toUpperCase()).filter(s => /^[A-Z.\-]{1,12}$/.test(s)))].slice(0, 1000)
    : [];
  const notes = {};
  if (value?.notes && typeof value.notes === "object" && !Array.isArray(value.notes)) {
    for (const symbol of interested) {
      const note = value.notes[symbol];
      if (typeof note === "string" && note.trim()) notes[symbol] = note.slice(0, 120);
    }
  }
  return { interested, notes };
}

export class UserState {
  constructor(ctx) { this.storage = ctx.storage; }

  async fetch(request) {
    const saved = await this.storage.get("state");
    if (request.method === "GET") return json(saved || { interested: [], notes: {}, initialized: false });
    if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Invalid JSON" }, 400); }

    const incoming = cleanSharedState(body);
    let next = incoming;
    if (body?.merge === true && saved) {
      const current = cleanSharedState(saved);
      next = {
        interested: [...new Set([...current.interested, ...incoming.interested])],
        notes: { ...current.notes, ...incoming.notes }
      };
    }
    const state = { ...next, initialized: true, updatedAt: new Date().toISOString() };
    await this.storage.put("state", state);
    return json(state);
  }
}

async function validPin(submitted, expected) {
  if (typeof submitted !== "string" || typeof expected !== "string") return false;
  return equalBytes(await digest(submitted), await digest(expected));
}

async function validCookie(request, expectedPin) {
  const supplied = cookieValue(request);
  if (!supplied) return false;
  const expected = await authToken(expectedPin);
  return equalBytes(encoder.encode(supplied), encoder.encode(expected));
}

export default {
  async fetch(request, env) {
    if (!env.SITE_PIN) {
      return new Response("SITE_PIN is not configured", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=UTF-8", "Cache-Control": "no-store" }
      });
    }

    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/__auth") {
      const form = await request.formData();
      if (!(await validPin(form.get("pin"), env.SITE_PIN))) return pinPage(true);

      return new Response(null, {
        status: 303,
        headers: {
          "Location": "/",
          "Cache-Control": "no-store",
          "Set-Cookie": `${COOKIE_NAME}=${await authToken(env.SITE_PIN)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; Secure; HttpOnly; SameSite=Lax`
        }
      });
    }

    if (!(await validCookie(request, env.SITE_PIN))) return pinPage();
    if (url.pathname === "/api/state") {
      if (request.method !== "GET" && request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
      const id = env.USER_STATE.idFromName("primary");
      return env.USER_STATE.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

