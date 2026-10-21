/**
 * בדיקות יחידה לשכבת האחסון (assets/store.js) — ללא תלויות.
 * הרצה: node tests/store.test.js
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const KEY_FALLBACK = "jlm-street-journal-v1";

function createStorageMock() {
  const mem = Object.create(null);
  return {
    mem,
    getItem: (key) => (key in mem ? mem[key] : null),
    setItem: (key, value) => {
      mem[key] = String(value);
    },
    removeItem: (key) => {
      delete mem[key];
    }
  };
}

function loadStore(storage) {
  const sandbox = { localStorage: storage };
  sandbox.window = sandbox;
  const code = fs.readFileSync(path.join(ROOT, "assets", "store.js"), "utf8");
  new Function("window", "localStorage", code)(sandbox, storage);
  return sandbox.JLMStore;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let storage;
let Store;

function reset() {
  storage = createStorageMock();
  Store = loadStore(storage);
}

test("טעינה במצב ריק מחזירה status=empty", () => {
  reset();
  assert.equal(Store.load().status, "empty");
  assert.deepEqual(Object.keys(Store.load().state.visited), []);
});

test("שמירה וטעינה שומרות ביקור ותאריך", () => {
  reset();
  Store.save({ schema: 1, visited: { yafo: { date: "2026-01-02", note: "קפה" } }, custom: [] });
  const loaded = Store.load();
  assert.equal(loaded.status, "ok");
  assert.equal(loaded.state.visited.yafo.date, "2026-01-02");
  assert.equal(loaded.state.visited.yafo.note, "קפה");
});

test("שמירה וטעינה שומרות רחובות שנמחקו ידנית, בלי כפילות", () => {
  reset();
  Store.save({
    schema: 1,
    visited: { yafo: { date: "2026-01-02", note: "קפה" } },
    custom: [],
    deleted: ["yafo", "yafo", "jlm-123"]
  });
  const loaded = Store.load();
  assert.equal(loaded.status, "ok");
  assert.deepEqual(loaded.state.deleted, ["yafo", "jlm-123"]);
  assert.equal(loaded.state.visited.yafo.note, "קפה", "הביקור נשמר גם כשרחוב נמחק");
});

test("גיבוי שמכיל רק מחיקות הוא גיבוי תקין", () => {
  reset();
  const result = Store.fromJSON(JSON.stringify({ visited: {}, custom: [], deleted: ["yafo"] }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.deleted, ["yafo"]);
});

test("ייבוא רשימת מחיקות לא תקינה נדחה", () => {
  reset();
  const result = Store.fromJSON(JSON.stringify({ deleted: [null, 42, ""] }));
  assert.equal(result.ok, false);
  assert.ok(result.error.length > 0);
});

test("מצב אחסון שמכיל רק מחיקות נטען תקין", () => {
  reset();
  storage.setItem(Store.KEY, JSON.stringify({ deleted: ["yafo"] }));
  const loaded = Store.load();
  assert.equal(loaded.status, "ok");
  assert.deepEqual(loaded.state.deleted, ["yafo"]);
});

test("JSON פגום לא נמחק בשקט ומחזיר status=corrupt", () => {
  reset();
  storage.setItem(Store.KEY, "{broken");
  const loaded = Store.load();
  assert.equal(loaded.status, "corrupt");
  assert.equal(loaded.raw, "{broken");
  assert.equal(storage.getItem(Store.KEY), "{broken", "הנתונים המקוריים לא נדרסו בטעינה");
});

test("גיבוי נתונים פגומים נשמר תחת מפתח נפרד", () => {
  reset();
  const key = Store.backup('{"visited":');
  assert.ok(key.startsWith(Store.KEY + ":corrupt:"));
  assert.equal(storage.getItem(key), '{"visited":');
});

test("ייבוא JSON שאינו גיבוי היומן נדחה", () => {
  reset();
  for (const bad of ["{}", "[]", "null", '{"name":"package"}', '{"visited":{}}', '{"custom":[]}']) {
    const result = Store.fromJSON(bad);
    assert.equal(result.ok, false, `אמור להיכשל: ${bad}`);
    assert.ok(result.error.length > 0);
  }
});

test("ייבוא גיבוי תקין עובר סניטציה", () => {
  reset();
  const result = Store.fromJSON(
    JSON.stringify({ visited: { "yafo": { date: "2026-01-02", note: "x".repeat(900) } }, custom: [] })
  );
  assert.equal(result.ok, true);
  assert.equal(result.state.visited.yafo.note.length, 500, "הערה נחתכת ל-500 תווים");
});

test("מזהה __proto__ לא מזהם את prototype", () => {
  reset();
  const result = Store.fromJSON('{"visited":{"__proto__":{"date":"2026-01-02","note":"x"}}}');
  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.state.visited, "__proto__"), true);
  assert.equal({}.date, undefined);
});

test("תאריך לא תקין מוחלף במחרוזת ריקה", () => {
  reset();
  const result = Store.fromJSON('{"visited":{"yafo":{"date":"21/10/2026","note":""}}}');
  assert.equal(result.state.visited.yafo.date, "");
});

test("ניקוי מוחק את המפתח הראשי", () => {
  reset();
  Store.save({ schema: 1, visited: {}, custom: [] });
  assert.equal(Store.clear(), true);
  assert.equal(storage.getItem(Store.KEY), null);
  assert.ok(Store.KEY.length > 0);
  assert.equal(KEY_FALLBACK, Store.KEY, "שם המפתח שונה — יש לעדכן גם את בדיקות הדפדפן");
});

test("שמירה נכשלת מחזירה false ולא זורקת", () => {
  reset();
  const failing = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceeded");
    },
    removeItem: () => {}
  };
  const FailingStore = loadStore(failing);
  assert.equal(FailingStore.save({ schema: 1, visited: {}, custom: [] }), false);
  assert.equal(FailingStore.load().status, "empty");
});

test("אחסון חסום לחלוטין מדווח status=unavailable", () => {
  reset();
  const blocked = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("SecurityError");
    },
    removeItem: () => {
      throw new Error("SecurityError");
    }
  };
  const BlockedStore = loadStore(blocked);
  assert.equal(BlockedStore.load().status, "unavailable");
  assert.equal(BlockedStore.clear(), false);
});

test("JSON תקין שאבד את כל תוכנו בסניטציה מסומן corrupt", () => {
  reset();
  storage.setItem(Store.KEY, '{"visited":{"a":1,"b":"x"},"custom":[]}');
  assert.equal(Store.load().status, "corrupt");
});

test("אובדן חלקי בסניטציה לא מסומן corrupt", () => {
  reset();
  storage.setItem(
    Store.KEY,
    '{"visited":{"yafo":{"date":"2026-01-02","note":"ok"},"bad":1},"custom":[]}'
  );
  const loaded = Store.load();
  assert.equal(loaded.status, "ok");
  assert.equal(Object.keys(loaded.state.visited).length, 1);
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log("PASS  " + name);
  } catch (error) {
    failed += 1;
    console.log("FAIL  " + name + "\n      " + error.message);
  }
}

console.log("\n" + (tests.length - failed) + "/" + tests.length + " עברו");
process.exit(failed === 0 ? 0 : 1);
