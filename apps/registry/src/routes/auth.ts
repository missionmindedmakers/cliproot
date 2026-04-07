import { Hono } from "hono";
import type { AppContext } from "../app.js";

export function createAuthRoutes(ctx: AppContext) {
  const routes = new Hono();

  // BetterAuth catch-all: handles sign-up, sign-in, session, device flow, etc.
  // All BetterAuth endpoints live under /api/auth/*
  routes.all("/api/auth/*", async (c) => {
    return ctx.auth.handler(c.req.raw);
  });

  // Device verification page — user visits this URL from the CLI prompt.
  // Serves a simple HTML form where the user enters the device code.
  routes.get("/device", (c) => {
    const userCode = c.req.query("user_code") ?? "";
    return c.html(deviceVerificationPage(ctx.config.baseUrl, userCode));
  });

  return routes;
}

function deviceVerificationPage(baseUrl: string, prefillCode: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cliproot — Device Authorization</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8f9fa; color: #1a1a2e; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: white; border-radius: 12px; padding: 2rem; max-width: 420px; width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { font-size: 0.9rem; color: #555; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.5rem; }
    input[type="text"] { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1.25rem; text-align: center; letter-spacing: 0.15em; text-transform: uppercase; }
    input[type="text"]:focus { outline: none; border-color: #4361ee; box-shadow: 0 0 0 3px rgba(67,97,238,0.15); }
    button { width: 100%; padding: 0.75rem; border: none; border-radius: 8px; background: #4361ee; color: white; font-size: 1rem; font-weight: 500; cursor: pointer; margin-top: 1rem; }
    button:hover { background: #3a56d4; }
    button:disabled { background: #aaa; cursor: not-allowed; }
    .status { margin-top: 1rem; padding: 0.75rem; border-radius: 8px; font-size: 0.9rem; display: none; }
    .status.error { display: block; background: #fce4ec; color: #c62828; }
    .status.success { display: block; background: #e8f5e9; color: #2e7d32; }
    .login-link { margin-top: 1rem; text-align: center; font-size: 0.85rem; }
    .login-link a { color: #4361ee; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Device Authorization</h1>
    <p>Enter the code shown in your terminal to authorize the CLI.</p>
    <form id="device-form">
      <label for="code">Device Code</label>
      <input type="text" id="code" name="code" maxlength="12" placeholder="ABCD1234"
        value="${escapeHtml(prefillCode)}" autocomplete="off" autofocus>
      <button type="submit" id="submit-btn">Authorize Device</button>
    </form>
    <div class="status" id="status"></div>
    <div class="login-link">
      Not logged in? <a href="${baseUrl}/api/auth/sign-in" id="login-link">Sign in first</a>
    </div>
  </div>
  <script>
    const form = document.getElementById('device-form');
    const status = document.getElementById('status');
    const btn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('code').value.trim().replace(/-/g, '');
      if (!code) return;

      btn.disabled = true;
      btn.textContent = 'Authorizing...';
      status.className = 'status';
      status.style.display = 'none';

      try {
        const res = await fetch('${baseUrl}/api/auth/device/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userCode: code }),
          credentials: 'include',
        });
        const body = await res.json();

        if (res.ok && body.success) {
          status.className = 'status success';
          status.textContent = 'Device authorized! You can close this page and return to your terminal.';
          status.style.display = 'block';
          btn.textContent = 'Authorized';
        } else {
          const msg = body.error_description || body.message || 'Authorization failed.';
          if (msg.includes('Authentication required') || msg.includes('unauthorized')) {
            status.className = 'status error';
            status.textContent = 'You need to sign in first before authorizing.';
          } else {
            status.className = 'status error';
            status.textContent = msg;
          }
          status.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Authorize Device';
        }
      } catch (err) {
        status.className = 'status error';
        status.textContent = 'Network error. Please try again.';
        status.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Authorize Device';
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
