"use strict";

// Read-only route regression checks; no browser profile or user data is modified.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

async function main() {
  const index = read("index.html");
  const redirect = [...index.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  for (const [standalone, ios, expected] of [
    [false, false, "welcome.html"],
    [true, false, "app.html"],
    [false, true, "app.html"]
  ]) {
    let actual;
    vm.runInNewContext(redirect, { window: {
      matchMedia: () => ({ matches: standalone }),
      navigator: { standalone: ios },
      location: { search: "?pwa=1", hash: "#faq", replace: (url) => { actual = url; } }
    } });
    assert.strictEqual(actual, expected + "?pwa=1#faq");
  }
  assert.match(index, /name="robots" content="noindex,follow"/);
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.strictEqual(manifest.start_url, "./app.html");
  assert.strictEqual(manifest.id, "./");
  assert.strictEqual(manifest.scope, "./");

  const beta = read("beta.html");
  assert.match(beta, /window.JLM_BETA = true/);
  assert.doesNotMatch(beta, /rel="manifest"|src="assets\/pwa.js"/);
  const loadStore = (isBeta) => {
    const saved = JSON.stringify({ schema: 1, visited: { yafo: { date: "2026-10-20", note: "existing" } } });
    const values = new Map([["jlm-street-journal-v1", saved]]);
    const window = { JLM_BETA: isBeta, localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value)
    } };
    vm.runInNewContext(read("assets/store.js"), { window });
    const loaded = window.JLMStore.load().state;
    if (!isBeta) assert.strictEqual(loaded.visited.yafo.note, "existing");
    else {
      assert.strictEqual(Object.keys(loaded.visited).length, 0);
      window.JLMStore.save(loaded);
      assert(values.has("jlm-street-journal-beta-v1"));
      assert.strictEqual(values.get("jlm-street-journal-v1"), saved);
    }
  };
  loadStore(false);
  loadStore(true);

  // Exercise the real SW fetch handler with offline and HTTP 503 responses.
  for (const serverError of [false, true]) {
    const listeners = {};
    const cached = new Map([
      ["https://test/jerusalem-streets/", "ROOT"],
      ["https://test/jerusalem-streets/index.html", "ROOT"],
      ["https://test/jerusalem-streets/welcome.html", "LANDING"],
      ["https://test/jerusalem-streets/app.html", "JOURNAL"]
    ]);
    vm.runInNewContext(read("sw.js"), {
      self: { location: { origin: "https://test" }, addEventListener: (name, fn) => { listeners[name] = fn; } },
      URL, Response,
      fetch: async () => { if (serverError) return { status: 503 }; throw new Error("offline"); },
      caches: { match: async (request, options = {}) => {
        const url = new URL(typeof request === "string" ? request : request.url, "https://test/jerusalem-streets/");
        if (options.ignoreSearch) url.search = "";
        return cached.get(url.href);
      } }
    });
    for (const [route, expected] of [["", "ROOT"], ["index.html", "ROOT"], ["welcome.html", "LANDING"], ["app.html", "JOURNAL"], ["unknown", "JOURNAL"]]) {
      let response;
      listeners.fetch({ request: { method: "GET", mode: "navigate", url: "https://test/jerusalem-streets/" + route + "?pwa=1" }, respondWith: (value) => { response = value; } });
      assert.strictEqual(await response, expected, route);
    }
  }
  console.log("PASS routing: redirects, PWA identity, existing visits, beta isolation, offline/503 routes");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
