/**
 * שכבת אחסון: טעינה, שמירה, ניקוי וייבוא/ייצוא של המצב.
 * כל הנתונים נשמרים ב-localStorage תחת מפתח אחד, והם עוברים סניטציה בכל טעינה.
 */
(function (global) {
  "use strict";

  var KEY = "jlm-street-journal-v1";
  var SCHEMA = 1;
  var MAX_NOTE = 500;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  /** מפת ביקורים ללא אב-טיפוס, כדי שמזהים כמו __proto__ לא ייפלו ל-prototype chain */
  function emptyVisited() {
    return Object.create(null);
  }

  function emptyState() {
    return { schema: SCHEMA, visited: emptyVisited(), custom: [], deleted: [], manualCompletions: {} };
  }

  function cleanText(value, maxLength) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLength);
  }

  function validId(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 120;
  }

  /** ממיר קלט לא אמין (מקומי או מיובא) למצב תקין */
  function sanitize(input) {
    var out = emptyState();
    if (!isPlainObject(input)) return out;

    if (isPlainObject(input.visited)) {
      Object.keys(input.visited).forEach(function (id) {
        var record = input.visited[id];
        if (!validId(id) || !isPlainObject(record)) return;
        var date = typeof record.date === "string" && DATE_RE.test(record.date) ? record.date : "";
        out.visited[id] = { date: date, note: cleanText(record.note, MAX_NOTE) };
      });
    }

    if (Array.isArray(input.custom)) {
      var seen = Object.create(null);
      input.custom.forEach(function (street) {
        if (!isPlainObject(street) || !validId(street.id)) return;
        var name = cleanText(street.name, 80);
        if (!name || seen[street.id]) return;
        seen[street.id] = true;
        out.custom.push({ id: street.id, name: name, area: cleanText(street.area, 80) || "אחר" });
      });
    }

    // רחובות שנמחקו ידנית: מזהים בלבד, בלי כפילות. הרשומה המקורית נשארת ב-data.js
    // כדי שאפשר יהיה לשחזר אותה ואת הביקור שלה.
    if (Array.isArray(input.deleted)) {
      var seenDeleted = Object.create(null);
      input.deleted.forEach(function (id) {
        if (!validId(id) || seenDeleted[id]) return;
        seenDeleted[id] = true;
        out.deleted.push(id);
      });
    }

    // סיום ידני של שכונות: area -> { note, completedAt }
    if (isPlainObject(input.manualCompletions)) {
      Object.keys(input.manualCompletions).forEach(function (area) {
        var rec = input.manualCompletions[area];
        if (!isPlainObject(rec)) return;
        var note = cleanText(rec.note, MAX_NOTE);
        var completedAt = typeof rec.completedAt === "string" && DATE_RE.test(rec.completedAt) ? rec.completedAt : new Date().toISOString().split("T")[0];
        out.manualCompletions[area] = { note: note, completedAt: completedAt };
      });
    }

    return out;
  }

  /** מחזיר את מספר הרשומות הגולמיות בקלט, כדי לזהות אובדן תוכן בסניטציה */
  function countRawEntries(input) {
    var count = 0;
    if (isPlainObject(input.visited)) count += Object.keys(input.visited).length;
    if (Array.isArray(input.custom)) count += input.custom.length;
    if (Array.isArray(input.deleted)) count += input.deleted.length;
    if (isPlainObject(input.manualCompletions)) count += Object.keys(input.manualCompletions).length;
    return count;
  }

  /**
   * טוען את המצב ומחזיר גם את מצב האחסון, כדי שהיישום לא ידרוס בשקט נתונים פגומים:
   * status = "empty" | "ok" | "corrupt" | "unavailable"
   */
  function load() {
    var raw;
    try {
      raw = global.localStorage.getItem(KEY);
    } catch (error) {
      return { state: emptyState(), status: "unavailable", raw: "" };
    }

    if (raw === null || raw === "") {
      return { state: emptyState(), status: "empty", raw: "" };
    }

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { state: emptyState(), status: "corrupt", raw: raw };
    }

    if (!isPlainObject(parsed)) {
      return { state: emptyState(), status: "corrupt", raw: raw };
    }

    var state = sanitize(parsed);
    var kept = Object.keys(state.visited).length + state.custom.length + state.deleted.length;

    // JSON תקין אבל הסניטציה זרקה את כל התוכן — נתייחס לזה כקורופציה, לא כמצב ריק
    if (countRawEntries(parsed) > 0 && kept === 0) {
      return { state: emptyState(), status: "corrupt", raw: raw };
    }

    return { state: state, status: "ok", raw: raw };
  }

  function save(state) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clear() {
    try {
      global.localStorage.removeItem(KEY);
      global.localStorage.removeItem(KEY + ":corrupt:last");
      return true;
    } catch (error) {
      return false;
    }
  }

  /** שומר עותק של נתונים פגומים לפני שמשהו דורס אותם (מפתח קבוע — לא מצטבר) */
  function backup(raw) {
    if (!raw) return "";
    var key = KEY + ":corrupt:last";
    try {
      global.localStorage.setItem(key, raw);
      return key;
    } catch (error) {
      return "";
    }
  }

  function toJSON(state) {
    return JSON.stringify(state, null, 2);
  }

  /** מחזיר { ok, state, error } — לא זורק חריגה ודוחה קבצים שאינם גיבוי של היומן */
  function fromJSON(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return { ok: false, state: emptyState(), error: "הקובץ אינו JSON תקין" };
    }

    if (!isPlainObject(parsed)) {
      return { ok: false, state: emptyState(), error: "הקובץ אינו במבנה תקין" };
    }

    var hasVisited = isPlainObject(parsed.visited);
    var hasCustom = Array.isArray(parsed.custom);
    var hasDeleted = Array.isArray(parsed.deleted);
    if (!hasVisited && !hasCustom && !hasDeleted) {
      return {
        ok: false,
        state: emptyState(),
        error: "הקובץ אינו נראה כגיבוי של היומן (חסרים שדות visited, custom או deleted)"
      };
    }

    var state = sanitize(parsed);
    var entries = Object.keys(state.visited).length + state.custom.length + state.deleted.length;
    if (entries === 0) {
      return { ok: false, state: emptyState(), error: "הקובץ תקין אבל ריק — לא בוצעה החלפה" };
    }

    return { ok: true, state: state, error: "" };
  }

  global.JLMStore = {
    KEY: KEY,
    emptyState: emptyState,
    load: load,
    save: save,
    clear: clear,
    backup: backup,
    toJSON: toJSON,
    fromJSON: fromJSON,
    sanitize: sanitize
  };
})(window);
