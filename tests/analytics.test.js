import { test } from "node:test";
import assert from "node:assert/strict";
import { createNavigationAnalytics } from "../frontend/src/analytics.js";

test("VisitPulse navigation preserves privacy and isolates collector failures", async () => {
  const names = ["window", "location", "document", "navigator", "sessionStorage", "fetch"];
  const originals = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const calls = [];
  const config = { endpoint: "https://analytics.example/events", username: "rumble-test" };
  const set = (name, value) => Object.defineProperty(globalThis, name, { configurable: true, value });
  try {
    set("window", {});
    set("location", { origin: "https://rumble.example", pathname: "/" });
    set("document", { title: "Private name", referrer: "https://referrer.example/private?q=secret" });
    set("navigator", {});
    set("sessionStorage", {
      getItem() { throw new Error("Storage blocked"); },
      setItem() { throw new Error("Storage blocked"); },
    });
    set("fetch", async (url, options) => {
      calls.push({ url, options, body: JSON.parse(options.body) });
      return { ok: true };
    });
    const track = createNavigationAnalytics(config);
    assert.equal(await track({ pathname: "/" }), true);
    await track({ pathname: "/" });
    await track({ pathname: "/", search: "?email=private@example.com" });
    assert.equal(calls.length, 1, "initial effect and query changes must not duplicate views");
    await track({ pathname: "/events/private-event-id" });
    await track({ pathname: "/unknown/private-name" });
    await track({ pathname: "/" });
    assert.deepEqual(calls.map(({ body }) => body.path), ["/", "/events/:id", "/not-found", "/"]);
    assert.equal(new Set(calls.map(({ body }) => body.sessionId)).size, 1);
    assert.equal(calls[0].options.credentials, "omit");
    assert.equal(calls[0].body.referrer, "https://referrer.example");
    assert.ok(!JSON.stringify(calls).includes("private"));
    await track({ pathname: "/playerstats" });
    await track({ pathname: "/results", search: "?tab=stats" });
    assert.equal(calls.length, 4, "redirect sources must not emit views");
    for (const privacy of [{ doNotTrack: "1" }, { globalPrivacyControl: true }]) {
      set("navigator", privacy);
      assert.equal(await createNavigationAnalytics(config)({ pathname: "/" }), false);
    }
    set("navigator", {});
    assert.equal(await createNavigationAnalytics({ ...config, username: "" })({ pathname: "/" }), false);
    assert.equal(await createNavigationAnalytics({ ...config, endpoint: "" })({ pathname: "/" }), false);
    assert.equal(calls.length, 4);
    let attempts = 0;
    set("fetch", async () => { attempts++; throw new Error("Offline"); });
    assert.equal(await createNavigationAnalytics(config)({ pathname: "/" }), false);
    assert.equal(attempts, 1, "collector failures must not retry");
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
