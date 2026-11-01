"use strict";

// Static regression checks, not a substitute for crawler/index coverage or WCAG testing.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const base = "https://ohadraiz.github.io/jerusalem-streets/";
const pages = ["index.html", "welcome.html", "app.html"];

for (const file of pages) {
  const html = read(file);
  assert.match(html, /<html lang="he" dir="rtl">/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, file + ": one h1");
  assert.match(html, /<title>ירושלים ברגל/);
  assert.match(html, /name="description"\s+content="[^"]+"/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, file + ": unique DOM IDs");
  for (const m of html.matchAll(/aria-(?:labelledby|describedby|controls)="([^"]+)"/g)) {
    for (const id of m[1].split(/\s+/)) assert.ok(ids.includes(id), file + ": ARIA reference " + id);
  }
  const canonical = file === "index.html" ? "welcome.html" : file;
  assert.ok(html.includes('<link rel="canonical" href="' + base + canonical + '"'));
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1, file + ": one canonical");
  assert.doesNotMatch(html, /name="robots" content="[^"]*noindex/);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:|data:)/.test(match[1])) continue;
    const [target, fragment] = match[1].split("#");
    const local = (target || file).split("?")[0];
    assert.ok(fs.existsSync(path.join(root, local)), file + ": " + local);
    if (fragment && local.endsWith(".html")) {
      assert.ok(read(local).includes('id="' + fragment + '"'), file + ": #" + fragment);
    }
  }
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const schema = JSON.parse(match[1]);
    assert.equal(schema["@context"], "https://schema.org");
    assert.equal(schema["@type"], "WebApplication");
    assert.equal(schema.url, base + "app.html");
    assert.equal(schema.name, "ירושלים ברגל");
    assert.equal(schema.inLanguage, "he");
    assert.equal(schema.isAccessibleForFree, true);
    assert.ok(!schema.aggregateRating && !schema.review, "No invented ratings");
  }
}

const window = {};
vm.runInNewContext(read("assets/data.js"), { window });
const streets = window.JLM_DATA.streets;
const facts = JSON.parse(read("data/didyouknow/index.json"));
assert.equal(facts.count, facts.ids.length);
assert.equal(new Set(facts.ids).size, facts.ids.length, "Unique fact IDs");
const streetIds = new Set(streets.map((s) => s.id));
for (const id of facts.ids) {
  assert.ok(streetIds.has(id), "Fact belongs to active street: " + id);
  assert.ok(fs.existsSync(path.join(root, "data/didyouknow", id + ".txt")), "Fact file: " + id);
}
const landing = read("welcome.html");
for (const count of [streets.length, new Set(streets.map((s) => s.area)).size, facts.ids.length]) {
  assert.ok(landing.includes(count.toLocaleString("en-US")), "Landing count " + count);
}
for (const file of ["beta.html", "internal/index.html", "tasks.html", "agents-dashboard.html",
  "agent-vs-subagent.html", "project-map.html", "guli.html", "versions.html"]) {
  assert.match(read(file), /name="robots" content="noindex/, file);
}
const sitemap = read("sitemap.xml");
const entries = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
assert.deepEqual(entries, [base + "welcome.html", base + "app.html"]);
for (const m of sitemap.matchAll(/<lastmod>(.*?)<\/lastmod>/g)) {
  assert.match(m[1], /^\d{4}-\d{2}-\d{2}$/);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  assert.ok(m[1] <= today, "No future lastmod (Jerusalem date)");
}
console.log("PASS SEO: metadata, Hebrew/RTL, local links/fragments, JSON-LD, data counts, exclusions, sitemap");
