// Isolated Edge smoke check. Uses fixture data and never loads .env or sends mail.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import session from "express-session";
import { createApp } from "../backend/app.js";
import { installBrowserFixtures } from "./browser-fixtures.js";
import * as limiters from "../backend/middleware/ratelimiters.js";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fixtures = installBrowserFixtures();
const store = new session.MemoryStore();
const server = createApp({
  store,
  sessionSecret: "browser-test-only-secret-at-least-32-characters",
}).listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(path.join(tmpdir(), "rumble-audit-"));
let browser, socket;
try {
  const browserPath =
    process.env.EDGE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  browser = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--disable-background-networking",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let launchError;
  browser.on("error", (error) => {
    launchError = error;
  });
  let debugPort;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    try {
      debugPort = (
        await readFile(path.join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      break;
    } catch {
      await pause(100);
    }
  }
  if (!debugPort) throw new Error("Browser did not start within 10 seconds");
  const targets = await (
    await fetch(`http://127.0.0.1:${debugPort}/json`)
  ).json();
  socket = new WebSocket(
    targets.find((target) => target.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let sequence = 0;
  const pending = new Map();
  let errors = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const operation = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) operation?.reject(new Error(message.error.message));
      else operation?.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown")
      errors.push(
        message.params.exceptionDetails.exception?.description ||
          message.params.exceptionDetails.text,
      );
    if (
      message.method === "Runtime.consoleAPICalled" &&
      message.params.type === "error"
    )
      errors.push(
        message.params.args
          .map((arg) => arg.value || arg.description)
          .join(" "),
      );
    if (
      message.method === "Network.responseReceived" &&
      message.params.response.url.startsWith(base) &&
      message.params.response.status >= 400
    )
      errors.push(
        `${message.params.response.status} ${message.params.response.url}`,
      );
  };
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const commandId = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(commandId);
        reject(new Error(`Timed out: ${method}`));
      }, 10000);
      pending.set(commandId, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      socket.send(JSON.stringify({ id: commandId, method, params }));
    });
  }
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Network.enable");
  const tokenResponse = await fetch(base + "/api/csrf-token");
  const cookie = tokenResponse.headers.get("set-cookie").split(";")[0];
  const cookieValue = cookie.slice(cookie.indexOf("=") + 1);
  const sid = decodeURIComponent(cookieValue).slice(2).split(".")[0];
  const stored = await new Promise((resolve) =>
    store.get(sid, (_, value) => resolve(value)),
  );
  await new Promise((resolve) =>
    store.set(
      sid,
      {
        ...stored,
        isAdmin: true,
        bowlerId: String(fixtures.bowler._id),
        bowlerEmail: fixtures.bowler.email,
      },
      resolve,
    ),
  );
  await cdp("Network.setCookie", {
    name: "connect.sid",
    value: cookieValue,
    url: base,
    httpOnly: true,
  });
  const eventId = String(fixtures.tournament._id);
  const pages = [
    "/",
    "/events",
    `/events/${eventId}`,
    "/register",
    `/register?tournament=${eventId}`,
    "/player-stats",
    "/bowler-hub",
    "/squads",
    `/squads?tournament=${eventId}`,
    "/results",
    `/results?tournament=${eventId}`,
    "/admin/login",
    "/admin/tournaments",
    "/admin/registrations",
    "/admin/results",
    `/admin/results?tournament=${eventId}`,
    "/admin/email-templates",
  ];
  let failures = 0;
  async function evaluate(expression) {
    const result = await cdp("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ||
          "Browser evaluation failed",
      );
    return result.result.value;
  }
  async function click(text) {
    await evaluate(
      `(() => { const el = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(text)}); if (!el) throw new Error('Missing button: ' + ${JSON.stringify(text)}); el.click(); })()`,
    );
    await pause(150);
  }
  async function input(label, value) {
    await evaluate(
      `(() => { const label = [...document.querySelectorAll('label')].find(el => el.querySelector('span')?.textContent === ${JSON.stringify(label)}); const el = label?.querySelector('input,textarea,select'); if (!el) throw new Error('Missing input'); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`,
    );
    await pause(100);
  }
  async function navigate(page) {
    for (const limiter of Object.values(limiters))
      limiter.resetKey("127.0.0.1");
    errors = [];
    await cdp("Page.navigate", { url: base + page });
    await pause(650);
  }
  for (const width of [1440, 390]) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 500,
    });
    for (const page of pages) {
      await navigate(page);
      const state = await evaluate(
        `({ ready: document.readyState, content: document.querySelector('main')?.textContent, overflow: document.documentElement.scrollWidth > innerWidth + 1, brokenImages: [...document.images].filter(i => i.complete && !i.naturalWidth).map(i => i.src) })`,
      );
      if (!state.content?.trim()) errors.push("React page is blank");
      if (state.content?.includes("Something went wrong"))
        errors.push("Error boundary rendered");
      if (state.overflow) errors.push("Horizontal page overflow");
      if (state.brokenImages.length)
        errors.push("Broken images: " + state.brokenImages.join(", "));
      if (page === "/") {
        const screenshot = await cdp("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
        });
        await writeFile(
          `qa-home-${width}.png`,
          Buffer.from(screenshot.data, "base64"),
        );
      }
      if (errors.length) {
        failures++;
        console.error(`FAIL ${width}px ${page}: ${errors.join(" | ")}`);
      } else console.log(`PASS ${width}px ${page}`);
    }
  }
  await navigate("/admin/tournaments");
  await click("+ New tournament");
  await input("Tournament name", "Browser-created event");
  await input("Venue", "Fixture Centre");
  await input("Start date", "2099-12-20");
  await click("Save tournament");
  await pause(400);
  if (!fixtures.events.some((t) => t.name === "Browser-created event"))
    throw new Error("Tournament create flow did not save");
  console.log("PASS tournament creation");
  await navigate(`/admin/results?tournament=${eventId}`);
  await evaluate(
    `(() => { const input = document.querySelector('.score-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '0'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  );
  await pause(100);
  await click("Save");
  await pause(300);
  if (
    fixtures.registration.stageScores[0].scores[0] !== 0 ||
    fixtures.registration.stageScores[0].scores.length !== 3
  )
    throw new Error(
      "Zero score was not saved: " +
        JSON.stringify(
          await evaluate(
            `({ notices: [...document.querySelectorAll('.notice')].map(n => n.textContent), inputs: [...document.querySelectorAll('.score-input')].map(n => n.value) })`,
          ),
        ) +
        " errors: " +
        errors.join(" | "),
    );
  console.log("PASS zero score saves without shifting games");
  await click('Review advancement');
  await click('Confirm');
  await pause(350);
  if (fixtures.registration.currentStage !== 1 || fixtures.registration.stageScores[1].carryover !== 0) throw new Error('Stage advancement failed');
  console.log('PASS server-side stage advancement and zero carryover');
  await navigate('/bowler-hub');
  await click('My profile');
  await input('Nickname', 'Browser tested');
  await click('Save profile');
  await pause(350);
  if (fixtures.bowler.nickname !== 'Browser tested') throw new Error('Profile edit did not persist');
  console.log('PASS bowler profile editing');
  await navigate('/admin/registrations');
  await evaluate(`(() => { const el = document.querySelector('select[aria-label^="Payment for"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, 'paid'); el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await pause(350);
  if (fixtures.registration.paymentStatus !== 'paid') throw new Error('Payment update did not persist');
  console.log('PASS payment status management');
  await navigate(`/register?tournament=${eventId}`);
  await evaluate(`document.querySelector('.squad-option input').click()`);
  await click("Continue to your details");
  await pause(300);
  await input("Full name", "Test New Bowler");
  await input("Email address", "new@example.com");
  await input("Phone number", "0400123456");
  await input("Competition division", "female");
  await evaluate(`document.querySelector('.check input').click()`);
  await click("Submit registration");
  await pause(400);
  if (
    !(await evaluate(
      `document.querySelector('main').textContent.includes('Entry received')`,
    ))
  )
    throw new Error("Registration flow did not complete");
  console.log("PASS squad selection, reservation, and registration");
  await navigate("/admin/email-templates");
  await click("Preview with sample data");
  await pause(300);
  if (
    !(await evaluate(
      `Boolean(document.querySelector('dialog[open] iframe[sandbox]'))`,
    ))
  )
    throw new Error("Email preview did not open");
  console.log("PASS sandboxed email preview");
  fixtures.state.failTournaments = true;
  await navigate('/events');
  if (!(await evaluate(`document.querySelector('main').textContent.includes('Try again')`))) throw new Error('Retry state missing');
  fixtures.state.failTournaments = false;
  await click('Try again'); await pause(350);
  if (!(await evaluate(`Boolean(document.querySelector('.event-card'))`))) throw new Error('Retry did not recover');
  console.log('PASS failed-request recovery');
  await evaluate(`document.querySelector('.menu-button').click()`);
  if (!(await evaluate(`document.querySelector('.menu-button').getAttribute('aria-expanded') === 'true'`))) throw new Error('Mobile navigation failed');
  console.log('PASS mobile menu');
  await cdp("Network.clearBrowserCookies");
  await navigate("/bowler-hub");
  if (
    !(await evaluate(
      `document.querySelector('main').textContent.includes('Send login code')`,
    ))
  )
    throw new Error("Guest hub login missing");
  await navigate("/admin/tournaments");
  if (!(await evaluate(`location.pathname === '/admin/login'`)))
    throw new Error("Admin route guard failed");
  console.log("PASS guest and admin authentication guards");
  if (failures) process.exitCode = 1;
  else
    console.log(
      `Browser smoke check passed for ${pages.length} pages with fixture data.`,
    );
} finally {
  socket?.close();
  browser?.kill();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  // Delete only this run's newly created temporary browser profile.
  if (
    path.dirname(profile) === path.resolve(tmpdir()) &&
    path.basename(profile).startsWith("rumble-audit-")
  ) {
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    }).catch(() => {});
  }
}
