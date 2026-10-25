/**
 * לוגיקת המסך: סינון, סימון ביקורים, סטטיסטיקות וייבוא/ייצוא.
 * תלוי ב-window.JLM_DATA (data.js) וב-window.JLMStore (store.js).
 *
 * מבנה הרשימה: אקורדיון שכונות כברירת מחדל, או תצוגה שטוחה של כל הרחובות.
 * רק שכונה פתוחה מרנדרת שורות רחובות — כך שלא נרנדרים 2,154 שורות בבת אחת.
 * שורת הרחוב מאפשרת גם ניווט למפה וגם סימון ביקור ישירות מהרשימה.
 */
(function () {
  "use strict";

  var Store = window.JLMStore;
  var BASE_STREETS = (window.JLM_DATA && window.JLM_DATA.streets) || [];
  var NOTE_SAVE_DELAY = 400;
  var MAX_NOTE = 500;
  var SEARCH_DEBOUNCE = 150;
  var UNDO_LIMIT = 10;
  var TOAST_TIMEOUT = 9000;
  var PAGE_SIZE = 50;
  var AREA_PAGE_SIZE = 20;
  var HIGHLIGHT_MS = 2600;

  var loaded = Store.load();
  var state = loaded.state;
  var storageStatus = loaded.status;
  var deletedIds = new Set(state.deleted || []);
  var filters = { query: "", area: "all", status: "all" };
  var visibleLimit = PAGE_SIZE;
  var pendingNoteTimers = Object.create(null);
  var pendingNoteValues = Object.create(null);

  /* מחסנית ביטול — בזיכרון בלבד, לא נשמרת באחסון ולא משנה את הסכמה */
  var undoStack = [];
  var toastTimer = 0;
  /* האלמנט שהיה ממוקד לפני שההתראה הופיעה — להחזרת הפוקוס כשההתראה נסגרת */
  var toastReturnFocus = null;

  /* מצב האקורדיון והתצוגה — בזיכרון בלבד */
  var openAreas = new Set();
  var areaLimit = AREA_PAGE_SIZE;
  var sortMode = "remaining";
  var listView = "areas"; // "areas" | "all"
  var streetSortMode = "asc"; // "asc" (א–ת) | "desc" (ת–א)
  var flatListPage = 1; // for paginated flat list

  /* שכונות שכבר חוגגו כ"הושלמה" בסשן הנוכחי — מונע חגיגה כפולה */
  var celebratedAreas = new Set();

  /* אבני דרך של התקדמות (אחוזים) שכבר חוגגו בסשן — מונע חגיגה כפולה */
  var milestoneReached = Object.create(null);
  var celebrationTimer = 0;

  var highlightTimer = 0;
  var streetCache = null;

  var el = {
    list: document.getElementById("street-list"),
    count: document.getElementById("list-count"),
    empty: document.getElementById("empty-state"),
    loading: document.getElementById("list-loading"),
    search: document.getElementById("search"),
    searchClear: document.getElementById("search-clear"),
    searchStatus: document.getElementById("search-status"),
    resultCount: document.getElementById("result-count"),
    searchHint: document.getElementById("search-hint"),
    area: document.getElementById("area-filter"),
    areaOptions: document.getElementById("area-options"),
    areaSort: document.getElementById("area-sort"),
    streetSort: document.getElementById("street-sort"),
    areaSortWrap: null,
    listHint: document.getElementById("list-hint"),
    viewButtons: Array.prototype.slice.call(document.querySelectorAll("[data-view]")),
    statusButtons: Array.prototype.slice.call(document.querySelectorAll("[data-status]")),
    progressBar: document.getElementById("progress-bar"),
    progressText: document.getElementById("progress-text"),
    statTotal: document.getElementById("stat-total"),
    statVisited: document.getElementById("stat-visited"),
    statLeft: document.getElementById("stat-left"),
    statPct: document.getElementById("stat-pct"),
    statsSummary: document.getElementById("stats-summary"),
    breakdown: document.getElementById("area-breakdown"),
    breakdownCount: document.getElementById("breakdown-count"),
    clearFiltersBtn: document.getElementById("clear-filters"),
    listClear: document.getElementById("list-clear"),
    filterSummary: document.getElementById("filter-summary"),
    mapSection: document.getElementById("map-section"),
    addForm: document.getElementById("add-form"),
    addName: document.getElementById("add-name"),
    addArea: document.getElementById("add-area"),
    exportBtn: document.getElementById("export-btn"),
    importBtn: document.getElementById("import-btn"),
    importInput: document.getElementById("import-input"),
    
    banner: document.getElementById("storage-banner"),
    bannerText: document.getElementById("storage-banner-text"),
    bannerClose: document.getElementById("banner-close"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toast-text"),
    toastUndo: document.getElementById("toast-undo"),
    toastClose: document.getElementById("toast-close"),
    voiceToggle: document.getElementById("voice-toggle"),
    soundToggle: document.getElementById("sound-toggle"),
    themeToggle: document.getElementById("theme-toggle"),
    randomBtn: document.getElementById("random-street"),
    celebration: document.getElementById("celebration"),
    achievementsList: document.getElementById("achievements-list"),
    achievementsCount: document.getElementById("achievements-count"),
    achievementsDetails: document.getElementById("achievements-details"),
    live: document.getElementById("live")
  };

  if (el.areaSort) {
    el.areaSortWrap = el.areaSort.closest(".field--sort");
  }

  /* ---------- עזרים ---------- */

  var bus = new EventTarget();

  window.JLMBus = bus;
  window.JLMAPI = {
    isVisited: isVisited,
    getVisit: function (id) {
      return Object.prototype.hasOwnProperty.call(state.visited, id) ? state.visited[id] : null;
    },
    getStreets: allStreets,
    isDeleted: isDeleted,
    getDeleted: function () {
      return state.deleted.slice();
    },
    toggle: toggleStreet,
    setVisited: function (id, visited) {
      if (visited === isVisited(id)) return;
      toggleStreet(id);
    },
    focusStreet: focusStreet
  };

  function emitVisitedChange(id) {
    bus.dispatchEvent(new CustomEvent("visited-change", { detail: { id: id, visited: isVisited(id) } }));
  }

  function emitVisitedReplace() {
    bus.dispatchEvent(new CustomEvent("visited-replace"));
  }

  function emitStreetsChange() {
    bus.dispatchEvent(new CustomEvent("streets-change"));
  }

  function showBanner(message) {
    el.banner.hidden = false;
    el.bannerText.textContent = message;
  }

  function hideBanner() {
    if (el.banner.hidden) return;
    el.banner.hidden = true;
    el.bannerText.textContent = "";
  }

  function clearNoteTimers() {
    Object.keys(pendingNoteTimers).forEach(function (id) {
      window.clearTimeout(pendingNoteTimers[id]);
      delete pendingNoteTimers[id];
      delete pendingNoteValues[id];
    });
  }

  /** שומר הערות שממתינות לדיבאונס לפני שהלשונית נסגרת */
  function flushPendingNotes() {
    var ids = Object.keys(pendingNoteTimers);
    if (ids.length === 0) return;

    ids.forEach(function (id) {
      window.clearTimeout(pendingNoteTimers[id]);
      delete pendingNoteTimers[id];

      // הערך נשמר בזמן ההקלדה, כדי לא לאבד אותו אם השורה הוחלפה בינתיים
      var value = pendingNoteValues[id];
      delete pendingNoteValues[id];
      if (typeof value === "string" && state.visited[id]) state.visited[id].note = value;
    });

    persist();
  }

  function findRow(id) {
    var rows = el.list.querySelectorAll("[data-id]");
    for (var i = 0; i < rows.length; i += 1) {
      if (rows[i].dataset.id === id) return rows[i];
    }
    return null;
  }

  /** מוצא את קבוצת השכונה לפי שמה (בלי להסתמך על בוררי CSS עם תווים מיוחדים) */
  function findGroup(area) {
    var groups = el.list.querySelectorAll(".area-group");
    for (var i = 0; i < groups.length; i += 1) {
      if (groups[i].dataset.group === area) return groups[i];
    }
    return null;
  }

  function announce(message) {
    el.live.textContent = "";
    window.setTimeout(function () {
      el.live.textContent = message;
    }, 30);
  }

  /** הגדרות משתמש נשמרות (חיווי קולי + צלילים) — ברירת המחדל: שניהם מופעלים */
  function settings() {
    if (!state.settings) state.settings = { voice: true, sound: true };
    if (typeof state.settings.sound !== "boolean") state.settings.sound = true;
    if (typeof state.settings.voice !== "boolean") state.settings.voice = true;
    return state.settings;
  }

  /* ---------- חיווי קולי ---------- */

  var speechQueue = [];
  var speaking = false;

  /** בונה אובייקט דיבור בעברית אם קיים קול — אחרת ברירת המחדל של הדפדפן */
  function hebrewVoice() {
    var voices = window.speechSynthesis.getVoices();
    for (var i = 0; i < voices.length; i += 1) {
      var lang = String(voices[i].lang || "").toLowerCase();
      if (lang.indexOf("he") === 0 || lang.indexOf("iw") === 0) return voices[i];
    }
    return null;
  }

  function nextSpeech() {
    if (!speechQueue.length) {
      speaking = false;
      return;
    }
    var text = speechQueue.shift();
    speaking = true;
    try {
      var utterance = new window.SpeechSynthesisUtterance(text);
      var voice = hebrewVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = "he-IL";
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = utterance.onerror = function () {
        speaking = false;
        nextSpeech();
      };
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      speaking = false;
      nextSpeech();
    }
  }

  /**
   * מדבר טקסט אם החיווי הקולי מופעל והדפדפן תומך.
   * ההודעות נשלחות בתור — כך חגיגה ואבן דרך לא חותכות זו את זו.
   */
  function speak(text) {
    if (!settings().voice) return;
    if (!isVoiceSupported()) return;
    speechQueue.push(text);
    if (!speaking) nextSpeech();
  }

  function stopSpeaking() {
    speechQueue = [];
    speaking = false;
    if (!window.speechSynthesis) return;
    try { window.speechSynthesis.cancel(); } catch (error) { /* noop */ }
  }

  function isVoiceSupported() {
    return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }

  /* ---------- צלילים ורטט (Web Audio API — בלי תלויות) ---------- */

  var audioCtx = null;
  function getAudioCtx() {
    if (audioCtx) return audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try { audioCtx = new Ctx(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }

  /** צליל קצר לפי סוג — "mark" (סימון), "complete" (השלמת שכונה), "milestone", "undo" */
  function playSound(type) {
    if (!settings().sound) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    var now = ctx.currentTime;
    var seq = [];
    if (type === "mark") seq = [[660, 0.07], [880, 0.09]];
    else if (type === "complete") seq = [[523, 0.08], [659, 0.08], [784, 0.12]];
    else if (type === "milestone") seq = [[784, 0.1], [988, 0.1], [1175, 0.16]];
    else if (type === "undo") seq = [[440, 0.08]];
    else seq = [[660, 0.07]];

    var t = now;
    seq.forEach(function (step) {
      var freq = step[0], dur = step[1];
      try {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      } catch (e) { /* noop */ }
      t += dur + 0.02;
    });
  }

  function haptic(pattern) {
    if (!settings().sound) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern || 15); } catch (e) { /* noop */ }
    }
  }

  function setSound(on) {
    settings().sound = on;
    persist();
    if (el.soundToggle) {
      el.soundToggle.setAttribute("aria-pressed", on ? "true" : "false");
      el.soundToggle.classList.toggle("is-active", on);
    }
    announce(on ? "צלילים הופעלו." : "צלילים כובו.");
  }

  function setVoice(on) {
    settings().voice = on;
    persist();
    if (el.voiceToggle) {
      el.voiceToggle.setAttribute("aria-pressed", on ? "true" : "false");
      el.voiceToggle.classList.toggle("is-active", on);
    }
    if (on) {
      if (!isVoiceSupported()) {
        showToast("הדפדפן הזה לא תומך בדיבור.");
        announce("הדפדפן לא תומך בחיווי קולי.");
      } else {
        /* בחלק מהדפדפנים רשימת הקולות נטענת א-סינכרונית */
        window.speechSynthesis.getVoices();
        speak("החיווי הקולי הופעל.");
        announce("החיווי הקולי הופעל.");
      }
    } else {
      stopSpeaking();
      announce("החיווי הקולי כובה.");
    }
  }

  /* ---------- חגיגה ואבני דרך ---------- */

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /** התנהגות גלילה: "smooth" או "auto" — לפי העדפת תנועה מופחתת */
  function scrollBehavior() {
    return prefersReducedMotion() ? "auto" : "smooth";
  }

  /**
   * גלילה חלקה רק למרחקים קצרים: קפיצה של כ־3,000 פיקסלים עם "smooth"
   * נמשכת ב-Chrome כ־2.5 שניות, וזו נראית כמו תקיעה. לכן קפיצה ארוכה
   * מתבצעת מיד ("auto"), ורק קפיצות קצרות מתחלקות בלי ניבוי.
   */
  var SMOOTH_SCROLL_LIMIT = 1200;

  function scrollBehaviorFor(distance) {
    if (prefersReducedMotion()) return "auto";
    return Math.abs(distance || 0) > SMOOTH_SCROLL_LIMIT ? "auto" : "smooth";
  }

  /* ---------- מצב תצוגה: בהיר / כהה ---------- */

  var themeMedia = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  /* null = לפי העדפת המערכת. הבחירה הידנית קיימת למשך השימוש בלבד —
     היא לא נשמרת באחסון (המפתח והסכמה קפוחים) ולכן אינה נוצרת קבצים חדשים. */
  var themeOverride = null;

  function systemPrefersDark() {
    return Boolean(themeMedia && themeMedia.matches);
  }

  function effectiveTheme() {
    if (themeOverride) return themeOverride;
    return systemPrefersDark() ? "dark" : "light";
  }

  function syncThemeButton() {
    if (!el.themeToggle) return;
    var dark = effectiveTheme() === "dark";
    var label = dark ? "מעבר למצב בהיר" : "מעבר למצב כהה";
    el.themeToggle.setAttribute("aria-pressed", dark ? "true" : "false");
    el.themeToggle.textContent = dark ? "🌗 מצב בהיר" : "🌗 מצב כהה";
    el.themeToggle.setAttribute("aria-label", label);
    el.themeToggle.setAttribute("title", label);
  }

  /** צבע שורת הדפדפן (theme-color) — מתעדכן לפי הערכה האפקטיבית */
  function syncThemeColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute("content", effectiveTheme() === "dark" ? "#17140f" : "#b5601f");
  }

  /** מעבר בין בהיר לכהה — משותף לכפתור ולקיצור המקלדת */
  function toggleTheme() {
    applyTheme(effectiveTheme() === "dark" ? "light" : "dark");
    announce(effectiveTheme() === "dark" ? "מצב כהה." : "מצב בהיר.");
  }

  function applyTheme(theme) {
    themeOverride = theme;
    var root = document.documentElement;
    if (theme === "dark") root.setAttribute("data-theme", "dark");
    else if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    syncThemeButton();
    syncThemeColor();
  }

  /** חגיגה ויזואלית קצרה (לא קול) — מושבתת אוטומטית בהעדפת תנועה מופחתת */
  function celebrate(text) {
    if (!el.celebration || prefersReducedMotion()) return;
    el.celebration.innerHTML =
      '<span class="celebration__emoji" aria-hidden="true">🎉</span>' +
      '<span class="celebration__text">' + escapeHtml(text || "") + "</span>";
    el.celebration.hidden = false;
    el.celebration.classList.add("is-show");
    window.clearTimeout(celebrationTimer);
    celebrationTimer = window.setTimeout(function () {
      el.celebration.classList.remove("is-show");
      el.celebration.hidden = true;
    }, 1900);
  }

  /**
   * חוגג כשחוצים אבן דרך אחוזים — פעם אחת בסשן.
   * שני האחוזים הם התקדמות כלל-עירית (רחובות שסומנו ÷ כל הרחובות הפעילים),
   * לא אחוז השכונה — אחרת 10 רחובות בשכונה קטנה היו משגיעים ל"10% מהרחובות".
   */
  /** אבני דרך לפי התקדמות כלל-עירית: מקבל visited/total (לא אחוזים!) כדי למנוע טעות חוזה */
  function checkMilestones(beforeVisited, beforeTotal, afterVisited, afterTotal) {
    var beforePercent = beforeTotal ? (beforeVisited / beforeTotal) * 100 : 0;
    var afterPercent = afterTotal ? (afterVisited / afterTotal) * 100 : 0;
    var marks = [10, 25, 50, 75, 90, 100];
    for (var i = 0; i < marks.length; i += 1) {
      var mark = marks[i];
      if (beforePercent < mark && afterPercent >= mark && !milestoneReached[mark]) {
        milestoneReached[mark] = true;
        celebrate("אבן דרך: " + mark + "% מהרחובות סומנו!");
        if (settings().voice) speak("אבן דרך: " + mark + "% מהרחובות סומנו. כל הכבוד!");
        break;
      }
    }
  }

  /** רצף ימים רצופים של ביקורים — בונה מתאריכי הביקורים השמורים */
  function streakDays() {
    var dates = Object.create(null);
    Object.keys(state.visited).forEach(function (id) {
      var record = state.visited[id];
      if (record && record.date) dates[record.date] = true;
    });

    function iso(date) {
      var month = String(date.getMonth() + 1).padStart(2, "0");
      var day = String(date.getDate()).padStart(2, "0");
      return date.getFullYear() + "-" + month + "-" + day;
    }

    var cursor = new Date();
    if (!dates[iso(cursor)]) cursor.setDate(cursor.getDate() - 1); /* עוד לא סימנו היום — נתחיל מאתמול */
    if (!dates[iso(cursor)]) return 0;

    var count = 0;
    while (dates[iso(cursor)]) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  var unlockedBadges = new Set();
  var achievementsPrimed = false;

  /** קטגוריות ההישגים — מסדרות את הגלריה בסביבת הבטא */
  var ACHIEVEMENT_CATEGORIES = [
    { id: "progress", label: "התקדמות ברחובות" },
    { id: "areas", label: "שכונות" },
    { id: "streak", label: "קצב ורצף" },
    { id: "insight", label: "התבוננות וסגנון" }
  ];

  /**
   * הישגים — מחושבים מההתקדמות (לא נשמרים בנפרד).
   * בסביבת הבטא: 9 הישגים נוספים + נתוני התקדמות לכל הישג, לגלריית ההישגים.
   * באתר הציבורי — בדיוק אותם 9 הישגים ואותו סדר כמו קודם.
   */
  function buildBadges() {
    var streets = allStreets();
    var total = streets.length;
    var visited = countVisited();
    var percent = percentValue(visited, total);
    var streak = streakDays();
    var rows = sortedAreaList();
    var anyAreaDone = rows.some(function (r) { return r.total > 0 && r.visited >= r.total; });
    var manualCount = Object.keys(state.manualCompletions || {}).length;

    /* נתוני עזר להישגים המורחבים — נגזרים מהמצב הקיים, ללא שינוי סכימה */
    var doneAreas = rows.filter(function (r) { return r.total > 0 && r.visited >= r.total; }).length;
    var ratedCount = 0;
    var notedCount = 0;
    var perDay = Object.create(null);
    Object.keys(state.visited).forEach(function (id) {
      var rec = state.visited[id];
      if (!rec) return;
      if (Number(rec.rating || 0) > 0) ratedCount += 1;
      if (String(rec.note || "").trim()) notedCount += 1;
      if (rec.date) perDay[rec.date] = (perDay[rec.date] || 0) + 1;
    });
    var maxDay = 0;
    Object.keys(perDay).forEach(function (day) {
      if (perDay[day] > maxDay) maxDay = perDay[day];
    });

    var badges = [
      { id: "first", icon: "🚶", title: "צעד ראשון", desc: "סמנו את הרחוב הראשון", category: "progress", progress: [visited, 1], unlocked: visited >= 1 },
      { id: "quarter", icon: "🏅", title: "רבע העיר", desc: "25% מהרחובות", category: "progress", progress: [visited, Math.ceil(total * 0.25)], unlocked: percent >= 25 },
      { id: "half", icon: "🌟", title: "חצי העיר", desc: "50% מהרחובות", category: "progress", progress: [visited, Math.ceil(total * 0.5)], unlocked: percent >= 50 },
      { id: "hundred", icon: "🎯", title: "100 רחובות", desc: "100 רחובות סומנו", category: "progress", progress: [visited, 100], unlocked: visited >= 100 },
      { id: "area", icon: "🏘️", title: "שכונה שלמה", desc: "כל הרחובות בשכונה", category: "areas", progress: [doneAreas, 1], unlocked: anyAreaDone },
      { id: "manual", icon: "✍️", title: "סיום ידני", desc: "סיום ידני של שכונה", category: "areas", progress: [manualCount, 1], unlocked: manualCount > 0 },
      { id: "streak7", icon: "🔥", title: "רצף 7 ימים", desc: "7 ימים ברצף", category: "streak", progress: [streak, 7], unlocked: streak >= 7 },
      { id: "voice", icon: "🔊", title: "חיווי קולי", desc: "חיווי קולי מופעל", category: "insight", progress: null, unlocked: settings().voice },
      { id: "all", icon: "🏆", title: "כל העיר", desc: "כל הרחובות סומנו", category: "progress", progress: total > 0 ? [visited, total] : null, unlocked: visited >= total && total > 0 }
    ];

    badges = badges.concat([
      { id: "ten", icon: "🌱", title: "10 רחובות", desc: "10 רחובות סומנו", category: "progress", progress: [visited, 10], unlocked: visited >= 10 },
      { id: "fifty", icon: "🏙️", title: "50 רחובות", desc: "50 רחובות סומנו", category: "progress", progress: [visited, 50], unlocked: visited >= 50 },
      { id: "streak3", icon: "☀️", title: "רצף 3 ימים", desc: "3 ימים ברצף", category: "streak", progress: [streak, 3], unlocked: streak >= 3 },
      { id: "streak14", icon: "🌋", title: "רצף 14 ימים", desc: "14 ימים ברצף", category: "streak", progress: [streak, 14], unlocked: streak >= 14 },
      { id: "twoAreas", icon: "🚏", title: "שתי שכונות שלמות", desc: "שתי שכונות הושלמו במלואן", category: "areas", progress: [doneAreas, 2], unlocked: doneAreas >= 2 },
      { id: "fiveAreas", icon: "🗺️", title: "חמש שכונות שלמות", desc: "חמש שכונות הושלמו במלואן", category: "areas", progress: [doneAreas, 5], unlocked: doneAreas >= 5 },
      { id: "rated20", icon: "⭐", title: "דירוג עשיר", desc: "20 ביקורים קיבלו דירוג", category: "insight", progress: [ratedCount, 20], unlocked: ratedCount >= 20 },
      { id: "chronicler", icon: "📓", title: "כרוניקן", desc: "10 הערות נכתבו מהשטח", category: "insight", progress: [notedCount, 10], unlocked: notedCount >= 10 },
      { id: "bigDay", icon: "⚡", title: "יום ענק", desc: "10 ביקורים ביום אחד", category: "streak", progress: [maxDay, 10], unlocked: maxDay >= 10 }
    ]);
    return badges;
  }

  function renderAchievements() {
    if (!el.achievementsList) return;
    var badges = buildBadges();

    var newly = [];
    badges.forEach(function (b) {
      if (b.unlocked && !unlockedBadges.has(b.id)) {
        unlockedBadges.add(b.id);
        newly.push(b);
      }
    });
    /* בטעינת הדף — לא מכריזים ולא מדברים, גם אם יש הישגים קיימים */
    if (achievementsPrimed && newly.length) {
      var names = newly.map(function (b) { return b.title; }).join(", ");
      announce("הישג חדש: " + names + ".");
      if (settings().voice) speak("הישג חדש: " + names + ".");
    }
    achievementsPrimed = true;

    if (el.achievementsCount) {
      el.achievementsCount.textContent = "(" + badges.filter(function (b) { return b.unlocked; }).length + "/" + badges.length + ")";
    }
    if (el.achievementsList) {
      el.achievementsList.innerHTML = badges.map(function (b) {
        return (
          '<li class="achievement' + (b.unlocked ? " is-unlocked" : " is-locked") + '">' +
            '<span class="achievement__icon" aria-hidden="true">' + b.icon + "</span>" +
            '<span class="achievement__title">' + escapeHtml(b.title) + "</span>" +
            '<span class="achievement__desc">' + escapeHtml(b.desc) + "</span>" +
            /* המצב "נעול" מסומן במילה, לא רק באטימות — כך שהוא קריא גם למי שאינו מבחין בצבע */
            (b.unlocked ? "" : '<span class="achievement__lock">לא פתוח</span>') +
          "</li>"
        );
      }).join("");
    }
    renderAchievementsGallery(badges);
  }

  /** "רחוב אקראי" — מציע רחוב שטרם ביקרתם בו, עובר אליו ומדגיש אותו */
  function suggestRandomStreet() {
    var pool = allStreets().filter(function (street) {
      return !isVisited(street.id);
    });
    if (!pool.length) pool = allStreets();
    if (!pool.length) return;

    var pick = pool[Math.floor(Math.random() * pool.length)];
    var area = pick.area || "אחר";
    openAreas.add(area);
    renderList();

    var row = findRow(pick.id);
    if (row) {
      highlightRow(pick.id);
      if (typeof row.scrollIntoView === "function") {
        var offset = row.getBoundingClientRect().top;
        row.scrollIntoView({ block: "center", behavior: scrollBehaviorFor(offset) });
      }
      /* הפוקוס עובר לרחוב המוצע — כך מקלדת יכולה להמשיך משם (Enter למפה, "v" לסימון) */
      var nameButton = row.querySelector('[data-action="goto"]');
      if (nameButton) {
        nameButton.setAttribute(
          "aria-label",
          "רחוב אקראי מוצע: " + pick.name + (pick.area ? ", " + pick.area : "")
        );
        nameButton.focus({ preventScroll: true });
      }
    }
    var text = "הצעה: אולי תבקרו ברחוב " + pick.name + (pick.area ? " ב" + pick.area : "") + ". (r להצעה חדשה)";
    showToast(text, null);
    announce(text);
    if (el.randomBtn) {
      el.randomBtn.setAttribute(
        "aria-label",
        "רחוב אקראי — הצעה אחרונה: " + pick.name + (pick.area ? ", " + pick.area : "")
      );
    }
  }

  function today() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  function normalize(text) {
    return String(text || "")
      .replace(/[\u0591-\u05C7]/g, "") // ניקוד וטעמים
      .replace(/["'׳״`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function invalidateStreets() {
    streetCache = null;
  }

  function isDeleted(id) {
    return deletedIds.has(id);
  }

  function allStreets() {
    if (!streetCache) {
      streetCache = BASE_STREETS.concat(state.custom).filter(function (street) {
        return !deletedIds.has(street.id);
      });
    }
    return streetCache;
  }

  /** כל המזהים המוכרים — כולל רחובות שנמחקו, כדי שלא ליצור מזהה כפול */
  function allKnownStreets() {
    return BASE_STREETS.concat(state.custom);
  }

  function findStreet(id) {
    var streets = allStreets();
    for (var i = 0; i < streets.length; i += 1) {
      if (streets[i].id === id) return streets[i];
    }
    return null;
  }

  /** מספרים עם מפריד אלפים — כדי שהספירות יישארו קריאות */
  function formatNumber(value) {
    return Number(value).toLocaleString("he-IL");
  }

  function isVisited(id) {
    return Object.prototype.hasOwnProperty.call(state.visited, id);
  }

  function countVisited() {
    var count = 0;
    allStreets().forEach(function (street) {
      if (isVisited(street.id)) count += 1;
    });
    return count;
  }

  /** אחוז עם ספרה אחת — 18.4% ולא 18% */
  function percentValue(visited, total) {
    if (!total) return 0;
    return (visited / total) * 100;
  }

  /**
   * התקדמות כלל-עירית: רחובות שסומנו ÷ כל הרחובות הפעילים בעיר.
   * אבני הדרך נמדדות במסד הזה ולא במסד השכונה — 10 רחובות משכונה אחת
   * אינם 10% מהעיר (רמות, השכונה הגדולה ביותר, מכילה 93 רחובות בלבד).
   */
  function cityProgress() {
    return { visited: countVisited(), total: allStreets().length };
  }

  function percentText(visited, total) {
    if (!total) return "0.0%";
    var text = percentValue(visited, total).toFixed(1);
    /* 2,153 מתוך 2,154 = 99.95% — אסור להציג "100.0%" כשעדיין נשאר רחוב אחד */
    if (visited < total && parseFloat(text) >= 100) text = "99.9";
    return text + "%";
  }

  function persist() {
    if (!Store.save(state)) {
      /* הבאנר הוא role="alert" ולכן מכריז בעצמו — לא מכפילים אותו כאן */
      showBanner("שמירה נשפלה — ייתכן שהאחסון בדפדפן חסום או מלא. השינויים קיימים בזיכרון בלבד.");
      return false;
    }
    hideBanner();
    return true;
  }

  /* ---------- סינון ---------- */

  var searchIndex = Object.create(null);
  var searchRenderTimer = 0;

  function rebuildIndex() {
    searchIndex = Object.create(null);
    allStreets().forEach(function (street) {
      searchIndex[street.id] = normalize(street.name + " " + (street.area || ""));
    });
  }

  function passesStatus(street) {
    var visited = isVisited(street.id);
    if (filters.status === "visited" && !visited) return false;
    if (filters.status === "pending" && visited) return false;
    return true;
  }

  function visibleStreets() {
    var query = normalize(filters.query);
    return allStreets().filter(function (street) {
      if (filters.area !== "all" && (street.area || "אחר") !== filters.area) return false;
      if (!passesStatus(street)) return false;
      if (!query) return true;
      return (searchIndex[street.id] || "").indexOf(query) !== -1;
    });
  }

  /** במצב חיפוש פעיל הרשימה שטוחה; אחרת — לפי בחירת התצוגה */
  function isSearchMode() {
    return filters.query.trim() !== "";
  }

  /** "כל הרחובות" או חיפוש פעיל — תצוגה שטוחה; אחרת אקורדיון שכונות */
  function isFlatMode() {
    return listView === "all" || isSearchMode();
  }

  /** רחובות לתצוגה השטוחה — לפי מיון האותיות, בלי לשנות את סדר הנתונים */
  function flatStreets() {
    return visibleStreets().slice().sort(function (a, b) {
      var order = String(a.name || "").localeCompare(String(b.name || ""), "he");
      return streetSortMode === "desc" ? -order : order;
    });
  }

  /* ---------- נתוני השכונות ---------- */

  /** מוחזר מפה שכונה → { area, total, visited, streets } */
  function computeAreaIndex() {
    var byArea = Object.create(null);

    allStreets().forEach(function (street) {
      var area = street.area || "אחר";
      if (!byArea[area]) byArea[area] = { area: area, total: 0, visited: 0, streets: [] };
      byArea[area].total += 1;
      if (isVisited(street.id)) byArea[area].visited += 1;
      byArea[area].streets.push(street);
    });

    return byArea;
  }

  /** מוני גלם ומוני ביקורים של שכונה אחת */
  function areaStats(area) {
    var total = 0;
    var visited = 0;
    allStreets().forEach(function (street) {
      if ((street.area || "אחר") !== area) return;
      total += 1;
      if (isVisited(street.id)) visited += 1;
    });
    return { total: total, visited: visited };
  }

  function streetsInArea(area) {
    return allStreets().filter(function (street) {
      return (street.area || "אחר") === area;
    });
  }

  /** רשימת השכונות לפי סדר המיון הנוכחי */
  function sortedAreaList() {
    var index = computeAreaIndex();
    var areas = Object.keys(index).map(function (key) {
      return index[key];
    });
    return sortAreas(areas);
  }

  /**
   * מיון ברירת מחדל: "כמעט הושלמה קודם".
   * רק שכונות שהתחילו (visited ≥ 1) נחשבות "כמעט הושלמה";
   * אחריהן שכונות שלא התחילו (קטנות קודם), ובסוף שהושלמו.
   */
  function sortAreas(areas) {
    var list = areas.slice();

    if (sortMode === "alpha") {
      list.sort(function (a, b) {
        return a.area.localeCompare(b.area, "he");
      });
      return list;
    }

    if (sortMode === "large") {
      list.sort(function (a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return a.area.localeCompare(b.area, "he");
      });
      return list;
    }

    list.sort(function (a, b) {
      var aDone = a.total > 0 && a.visited >= a.total;
      var bDone = b.total > 0 && b.visited >= b.total;
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (aDone && bDone) return a.area.localeCompare(b.area, "he");

      var aStarted = a.visited > 0;
      var bStarted = b.visited > 0;
      if (aStarted !== bStarted) return aStarted ? -1 : 1;

      if (aStarted) {
        var aLeft = a.total - a.visited;
        var bLeft = b.total - b.visited;
        if (aLeft !== bLeft) return aLeft - bLeft;
      }

      if (a.total !== b.total) return a.total - b.total;
      return a.area.localeCompare(b.area, "he");
    });

    return list;
  }

  /* ---------- רינדור ---------- */

  /**
   * שורת רחוב — ניווט למפה, סימון ביקור ישירות מהרשימה, ותאריך/הערה לביקור.
   * כפתור הסימון נפרד משם הרחוב כדי שלחיצה על השם תישאר ניווט בלבד.
   */
  function streetRow(street) {
    var record = Object.prototype.hasOwnProperty.call(state.visited, street.id)
      ? state.visited[street.id]
      : null;
    var visited = Boolean(record);
    var name = escapeHtml(street.name);
    var area = escapeHtml(street.area || "אחר");
    var mapsUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent([street.name, street.area, "ירושלים"].filter(Boolean).join(", "));
    var visitLabel = (visited ? "בטל את סימון הביקור ב" : "סמן שביקרתי ב") + name;

    return (
      '<li class="street' + (visited ? " is-visited" : "") + '" data-id="' + escapeHtml(street.id) + '"' +
        ' data-street-name="' + escapeHtml(street.name) + '">' +
        '<div class="street__body">' +
          '<div class="street__head">' +
            '<button type="button" class="street__name" data-action="goto" aria-label="הצג במפה את ' + name + '">' +
              name +
            "</button>" +
            '<span class="street__area">' + area + "</span>" +
            '<button type="button" class="street__visit' + (visited ? " is-visited" : "") + '"' +
              ' data-action="toggle-visit" aria-pressed="' + (visited ? "true" : "false") + '"' +
              ' aria-label="' + visitLabel + '" title="' + visitLabel + '">' +
              (visited ? "ביקרתי ✓" : "סמן ביקור") +
            "</button>" +
            '<a class="street__maps" href="' + escapeHtml(mapsUrl) + '" target="_blank" rel="noopener noreferrer">פתח ב-Google Maps ↗</a>' +
            '<button type="button" class="street__delete" data-action="delete-street"' +
              ' aria-label="מחק את הרחוב ' + name + ' מהרשימה ומהמפה" title="מחיקת הרחוב מהרשימה ומהמפה">מחק</button>' +
          "</div>" +
          (visited
            ? '<div class="street__details">' +
                '<label class="street__field">' +
                  '<span>תאריך ביקור</span>' +
                  '<input type="date" data-action="date" aria-label="תאריך ביקור ב' + name + '" value="' + escapeHtml(record.date || "") + '" />' +
                "</label>" +
                '<label class="street__field street__field--grow">' +
                  "<span>הערה</span>" +
                  '<input type="text" data-action="note" maxlength="500" aria-label="הערה על ' + name + '" placeholder="מה זכור לכם מהמקום?" value="' +
                    escapeHtml(record.note || "") + '" />' +
                "</label>" +
                '<div class="street__rating" role="group" aria-label="דירוג הביקור ב' + name + '">' +
                  [1, 2, 3, 4, 5].map(function (n) {
                    var on = record.rating >= n;
                    return '<button type="button" class="street__star' + (on ? " is-on" : "") + '" data-action="rate" data-id="' + escapeHtml(street.id) + '" data-rating="' + n + '" aria-pressed="' + (on ? "true" : "false") + '" aria-label="דירוג ' + n + ' מתוך 5">' + (on ? "★" : "☆") + "</button>";
                  }).join("") +
                "</div>" +
                '<div class="street__moods" role="group" aria-label="הרגשה ב' + name + '">' +
                  [["😊", "נהדר"], ["🙂", "טוב"], ["😐", "בסדר"], ["😕", "פחות"]].map(function (m) {
                    var on = record.mood === m[1];
                    return '<button type="button" class="street__mood' + (on ? " is-on" : "") + '" data-action="mood" data-id="' + escapeHtml(street.id) + '" data-mood="' + escapeHtml(m[1]) + '" aria-pressed="' + (on ? "true" : "false") + '"><span class="street__mood__emoji" aria-hidden="true">' + m[0] + "</span> " + m[1] + "</button>";
                  }).join("") +
                "</div>" +
              "</div>"
            : "") +
        "</div>" +
      "</li>"
    );
  }

  /** שם נגיש לכותרת שכונה — כולל המונים והסיום הידני, כדי שקורא מסך ידע מה נשאר */
  function areaLabel(area, visited, total, left, manual) {
    return (
      area + " — " + visited + " מתוך " + total + " רחובות סומנו, " +
      (left > 0 ? left + " נשארו" : "השכונה הושלמה") +
      (manual ? " · הושלמה ידנית" : "")
    );
  }

  /**
   * תג כותרת השכונה — גלוי גם כשהשכונה מקופלת:
   * "הושלמה" כשכל הרחובות סומנו, "ידנית" כשהושלמה ידנית, ואחרת מוסתר.
   */
  function areaBadgeMarkup(done, manual) {
    if (done) {
      return '<span class="area-group__badge">הושלמה</span>';
    }
    if (manual) {
      return '<span class="area-group__badge area-group__badge--manual" title="הושלמה ידנית">ידנית</span>';
    }
    return '<span class="area-group__badge" hidden></span>';
  }

  /** עדכון התג בכותרת השכונה — נקרא גם כשהשכונה מקופלת ואין לה כרטיס */
  function updateAreaBadge(badge, done, manual) {
    if (!badge) return;
    badge.classList.toggle("area-group__badge--manual", !done && manual);
    if (done) {
      badge.textContent = "הושלמה";
      badge.removeAttribute("title");
      badge.hidden = false;
    } else if (manual) {
      badge.textContent = "ידנית";
      badge.setAttribute("title", "הושלמה ידנית");
      badge.hidden = false;
    } else {
      badge.textContent = "";
      badge.removeAttribute("title");
      badge.hidden = true;
    }
  }

  /** כותרת שכונה + הפאנל שלה (רק אם פתוחה) */
  function areaMarkup(area, position) {
    var open = openAreas.has(area.area);
    var panelId = "area-panel-" + position;
    var done = area.total > 0 && area.visited >= area.total;
    var manual = Boolean(state.manualCompletions && state.manualCompletions[area.area]);
    var percent = percentValue(area.visited, area.total);
    var left = area.total - area.visited;

    return (
      '<li class="area-group' + (done ? " is-done" : "") + '" data-group="' + escapeHtml(area.area) + '">' +
        '<div class="area-group__head">' +
          '<button type="button" class="area-group__name" data-action="area-focus" data-area="' + escapeHtml(area.area) + '"' +
            ' aria-expanded="' + (open ? "true" : "false") + '" aria-controls="' + panelId + '"' +
            ' aria-label="' + escapeHtml(areaLabel(area.area, area.visited, area.total, left, manual)) + '"' +
            ' title="פותח את הרחובות של השכונה וממקד את המפה בה">' +
            escapeHtml(area.area) +
          "</button>" +
          '<span class="area-group__count" dir="ltr">' + area.visited + "/" + area.total + "</span>" +
          '<span class="area-group__pct">' + percentText(area.visited, area.total) + "</span>" +
          '<span class="area-group__bar" aria-hidden="true"><span style="width:' + percent.toFixed(2) + '%"></span></span>' +
          areaBadgeMarkup(done, manual) +
          '<button type="button" class="area-group__toggle" data-action="area-toggle" data-area="' + escapeHtml(area.area) + '"' +
            ' aria-expanded="' + (open ? "true" : "false") + '" aria-controls="' + panelId + '"' +
            ' aria-label="' + (open ? "סגור את הרחובות של " : "פתח את הרחובות של ") + escapeHtml(area.area) + '">' +
            '<span aria-hidden="true">▾</span>' +
          "</button>" +
        "</div>" +
        (open ? areaPanelMarkup(area, panelId) : '<div class="area-panel" id="' + panelId + '" hidden></div>') +
      "</li>"
    );
  }

  /** כרטיס השכונה: התקדמות ייעודית + פעולות גורפות */
  function areaPanelMarkup(area, panelId) {
    var percent = percentValue(area.visited, area.total);
    var left = area.total - area.visited;
    var isManualComplete = state.manualCompletions && state.manualCompletions[area.area];
    var rows = area.streets.filter(passesStatus).map(streetRow).join("");

    return (
      '<div class="area-panel" id="' + panelId + '">' +
        '<div class="area-card">' +
          '<p class="area-card__title">שכונת ' + escapeHtml(area.area) + ": " + area.visited + " מתוך " + area.total +
            " רחובות סומנו — " + percentText(area.visited, area.total) + (isManualComplete ? " · הושלמה ידנית" : "") + "</p>" +
          '<span class="area-card__bar" aria-hidden="true"><span style="width:' + percent.toFixed(2) + '%"></span></span>' +
          '<div class="area-card__actions">' +
            '<button type="button" class="btn btn--small" data-action="batch-mark" data-area="' + escapeHtml(area.area) + '"' +
              (left > 0 ? "" : " hidden") + ">סמן את כל השכונה</button>" +
            '<button type="button" class="btn btn--small btn--quiet" data-action="batch-unmark" data-area="' + escapeHtml(area.area) + '"' +
              (area.visited > 0 ? "" : " hidden") + ">בטל סימון השכונה</button>" +
            '<button type="button" class="btn btn--small" data-action="manual-complete" data-area="' + escapeHtml(area.area) + '"' +
              (isManualComplete ? " hidden" : "") + ">סיום ידני</button>" +
            '<button type="button" class="btn btn--small btn--quiet" data-action="manual-undo" data-area="' + escapeHtml(area.area) + '"' +
              (isManualComplete ? "" : " hidden") + ">בטל סיום ידני</button>" +
          "</div>" +
        "</div>" +
        (rows
          ? '<ul class="street-list__group">' + rows + "</ul>"
          : '<p class="area-panel__empty">אין רחובות להצגה בשכונה הזו</p>') +
      "</div>"
    );
  }

  /**
   * סרגל העימוד — מופיע פעמיים (למעלה ולמטה). לכל אחד שם נגיש אחר,
   * כדי שלא יהיו שני אזורי ניווט זהים בעץ הנגישות.
   */
  function paginationMarkup(totalPages, position) {
    var prevBtn = flatListPage > 1
      ? '<button type="button" class="pagination__btn" data-action="flat-prev" aria-label="עמוד קודם">‹ קודם</button>'
      : '<span class="pagination__btn pagination__btn--disabled" aria-hidden="true">‹ קודם</span>';
    var nextBtn = flatListPage < totalPages
      ? '<button type="button" class="pagination__btn" data-action="flat-next" aria-label="עמוד הבא">הבא ›</button>'
      : '<span class="pagination__btn pagination__btn--disabled" aria-hidden="true">הבא ›</span>';
    var pageInfo = '<span class="pagination__info" aria-live="polite">עמוד ' + flatListPage + " מתוך " + totalPages + "</span>";
    var label = position === "top" ? "דפדוף תוצאות — למעלה" : "דפדוף תוצאות — למטה";
    return '<li class="pagination" role="navigation" aria-label="' + label + '">' + prevBtn + pageInfo + nextBtn + "</li>";
  }

  /** תצוגה שטוחה — בשימוש חיפוש פעיל */
  function renderFlatList(streets) {
    var total = streets.length;
    var totalPages = Math.ceil(total / PAGE_SIZE);
    if (flatListPage > totalPages) flatListPage = 1;
    if (flatListPage < 1) flatListPage = 1;

    var start = (flatListPage - 1) * PAGE_SIZE;
    var slice = streets.slice(start, start + PAGE_SIZE);

    var pagination = totalPages > 1 ? paginationMarkup(totalPages, "top") : "";

    el.list.innerHTML =
      pagination + slice.map(streetRow).join("") + (totalPages > 1 ? paginationMarkup(totalPages, "bottom") : "");

    el.count.textContent =
      formatNumber(total) + " רחובות" +
      (total > PAGE_SIZE ? " · עמוד " + flatListPage + " מתוך " + totalPages : "");

    return { count: total };
  }

  /** תצוגת אקורדיון — רק שכונות פתוחות מרנדרות שורות */
  function renderAccordion() {
    var areas = sortedAreaList();

    if (filters.area !== "all") {
      areas = areas.filter(function (area) {
        return area.area === filters.area;
      });
    }

    var totalStreets = 0;
    areas.forEach(function (area) {
      totalStreets += area.total;
    });

    var rendered = [];
    var deferred = 0;

    areas.forEach(function (area) {
      /* שכונה שנפתחה ידנית תמיד מרונדרת — גם אם המיון דחק אותה מתחת למגבלה */
      if (rendered.length < areaLimit || openAreas.has(area.area)) {
        rendered.push(area);
      } else {
        deferred += 1;
      }
    });

    var html = rendered
      .map(function (area, position) {
        return areaMarkup(area, position);
      })
      .join("");

    if (deferred > 0) {
      html +=
        '<li class="street-more">' +
          '<button type="button" class="street-more__btn" data-action="more-areas">' +
            "הצג עוד " + formatNumber(Math.min(AREA_PAGE_SIZE, deferred)) + " שכונות (נשארו " + formatNumber(deferred) + ")" +
          "</button>" +
        "</li>";
    }

    el.list.innerHTML = html;

    el.count.textContent =
      formatNumber(areas.length) + " שכונות · " + formatNumber(totalStreets) + " רחובות";

    return { count: totalStreets };
  }

  function syncViewButtons() {
    el.viewButtons.forEach(function (button) {
      var active = button.dataset.view === listView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  /** מסתיר את מיון השכונות בתצוגה שטוחה ומעדכן את הרמז שמעל הרשימה */
  function syncListControls() {
    if (el.areaSortWrap) el.areaSortWrap.hidden = isFlatMode();
    if (el.streetSort) el.streetSort.closest(".field--street-sort").hidden = !isFlatMode();
    if (!el.listHint) return;

    var text;
    if (isSearchMode()) {
      text = "תוצאות חיפוש מכל השכונות. אפשר לסמן ביקור בכפתור שליד כל רחוב.";
    } else if (listView === "all") {
      text = "כל הרחובות מסודרים א׳–ת. אפשר לסמן ביקור בכפתור שליד כל רחוב.";
    } else {
      text = "כדי לסמן ביקור — לחצו על ׳סמן ביקור׳ ברשומה, או על קו הרחוב במפה.";
    }
    if (el.listHint.textContent !== text) el.listHint.textContent = text;
  }

  function setListView(view) {
    if (view !== "areas" && view !== "all") return;
    if (listView === view) {
      syncViewButtons();
      return;
    }

    listView = view;
    visibleLimit = PAGE_SIZE;
    if (view === "all") flatListPage = 1;
    renderList();
    announce(
      view === "all"
        ? "מוצגים כל הרחובות ברשימה אחת, מסודרים א׳–ת."
        : "מוצגות השכונות. פתחו שכונה כדי לראות את הרחובות שלה."
    );
  }

  function renderList() {
    /* לא לתת לדפדפן לקפוץ בזמן שמחליפים את הרשימה */
    var scrollY = window.scrollY || 0;

    var streets = isFlatMode() ? flatStreets() : visibleStreets();
    var result = isFlatMode() ? renderFlatList(streets) : renderAccordion();

    syncViewButtons();
    syncListControls();
    el.empty.hidden = result.count > 0;
    renderEmptyState(result.count);

    updateResultCount(result.count);

    if (Math.abs((window.scrollY || 0) - scrollY) > 1) {
      window.scrollTo(0, scrollY);
    }

    /* בטא: בזמן תצוגת היומן הרשימה מוסתרת כולה — מצב-הריק שלה לא אמור להופיע */
    if (journalActive && el.empty) el.empty.hidden = true;

    return result.count;
  }

  /** מצב ריק מובנה: מציין את המונח ומציע פעולת ניקוי */
  function renderEmptyState(count) {
    if (count > 0) {
      el.empty.innerHTML = "";
      return;
    }

    if (allStreets().length === 0) {
      el.empty.innerHTML =
        '<span class="empty__text">כל הרחובות הוסרו ידנית. אפשר לייבא גיבוי מהכפתור "ייבוא" שלמעלה כדי להחזיר אותם.</span>';
      return;
    }

    var reasons = [];
    var query = filters.query.trim();
    if (query) reasons.push("החיפוש ״" + query + "״");
    if (filters.area !== "all") reasons.push("השכונה ״" + filters.area + "״");
    if (filters.status === "visited") reasons.push("סטטוס: ביקרתי");
    if (filters.status === "pending") reasons.push("סטטוס: טרם ביקרתי");

    var text = reasons.length
      ? "לא נמצאו רחובות עבור " + reasons.join(", ") + "."
      : "לא נמצאו רחובות שמתאימים לסינון.";

    el.empty.innerHTML =
      '<span class="empty__text">' + escapeHtml(text) + "</span> " +
      '<button type="button" class="btn btn--small" data-action="clear-filters">ניקוי סינון</button>';
  }

  /** המונה ליד שדה החיפוש — חזותי; ההכרזה לקורא מסך נעשית בנפרד (#search-status) */
  function updateResultCount(count) {
    if (!el.resultCount) return;
    var text;
    if (isSearchMode()) {
      text = count === 0 ? "לא נמצאו תוצאות" : formatNumber(count) + " תוצאות";
    } else if (listView === "all") {
      text = formatNumber(count) + " רחובות" + (filters.area === "all" ? "" : " · " + filters.area);
    } else {
      text = filters.area === "all" ? "מציג את כל הרחובות" : "שכונה: " + filters.area;
    }
    if (el.resultCount.textContent !== text) el.resultCount.textContent = text;
  }

  function announceResults(count) {
    if (!el.searchStatus) return;
    var query = filters.query.trim();
    var message = "";
    if (query) {
      message = count === 0
        ? "לא נמצאו רחובות עבור " + query
        : "נמצאו " + formatNumber(count) + " רחובות עבור " + query;
    }
    if (el.searchStatus.textContent !== message) el.searchStatus.textContent = message;
  }

  function renderStats() {
    var streets = allStreets();
    var total = streets.length;
    var visited = countVisited();
    var left = total - visited;
    var percent = percentValue(visited, total);

    el.statTotal.textContent = formatNumber(total);
    el.statVisited.textContent = formatNumber(visited);
    el.statLeft.textContent = formatNumber(left);
    el.statPct.textContent = percentText(visited, total);

    el.progressBar.style.width = percent.toFixed(2) + "%";
    el.progressText.textContent =
      formatNumber(visited) + " מתוך " + formatNumber(total) + " רחובות (" + percentText(visited, total) +
      ") — נשארו " + formatNumber(left) + ".";

    var rows = sortedAreaList();

    if (el.statsSummary) {
      var streak = streakDays();
      el.statsSummary.textContent =
        formatNumber(rows.length) + " שכונות ברשימה · " + formatNumber(total) + " רחובות" +
        " · רצף ימים: " + streak;
    }
    if (el.breakdownCount) el.breakdownCount.textContent = "(" + formatNumber(rows.length) + ")";
    if (el.searchHint) {
      el.searchHint.textContent = formatNumber(total) + " רחובות · " + formatNumber(rows.length) + " שכונות";
    }

    /* הפירוט המלא (כל השכונות) חי בתוך <details> מקופל — בלי לאבד מידע */
    el.breakdown.innerHTML = rows
      .map(function (row) {
        var percentValueRow = percentValue(row.visited, row.total);
        return (
          '<li class="breakdown__item">' +
            '<button type="button" class="breakdown__row" data-area="' + escapeHtml(row.area) + '">' +
              '<span class="breakdown__area">' + escapeHtml(row.area) + "</span>" +
              '<span class="breakdown__bar"><span style="width:' + percentValueRow.toFixed(2) + '%"></span></span>' +
              '<span class="breakdown__value">' + row.visited + "/" + row.total + "</span>" +
            "</button>" +
          "</li>"
        );
      })
      .join("");

    renderAchievements();
    renderAreaOptions();
  }

  /**
   * שורת קיצורים: בכניסה ראשונה — השכונות הגדולות ביותר (נקודת התחלה);
   * אחרי שמתחילים לסמן — השכונות שבהן הכי התקדמנו.
   */

  function renderAreaOptions() {
    var rows = sortedAreaList();
    var current = filters.area;

    el.area.innerHTML = ['<option value="all">כל השכונות (' + formatNumber(allStreets().length) + ")</option>"]
      .concat(
        rows.map(function (row) {
          return (
            '<option value="' + escapeHtml(row.area) + '">' + escapeHtml(row.area) +
            " (" + row.visited + "/" + row.total + ")</option>"
          );
        })
      )
      .join("");

    var values = rows.map(function (row) {
      return row.area;
    });

    el.area.value = values.indexOf(current) !== -1 ? current : "all";
    filters.area = el.area.value;

    el.areaOptions.innerHTML = values
      .sort(function (a, b) {
        return a.localeCompare(b, "he");
      })
      .map(function (area) {
        return '<option value="' + escapeHtml(area) + '"></option>';
      })
      .join("");
  }

  /** מציג את הסינון הפעיל ומציע ניקוי — נפרד מכפתור "מחיקת כל הנתונים" */
  function renderFilters() {
    var query = filters.query.trim();
    var active = hasActiveFilters();

    if (el.clearFiltersBtn) el.clearFiltersBtn.hidden = !active;
    if (el.listClear) el.listClear.hidden = !active;
    if (el.searchClear) el.searchClear.hidden = !query;

    if (!el.filterSummary) return;

    var parts = [];
    if (query) parts.push("חיפוש: " + query);
    if (filters.area !== "all") parts.push("שכונה: " + filters.area);
    if (filters.status === "visited") parts.push("סטטוס: ביקרתי");
    if (filters.status === "pending") parts.push("סטטוס: טרם ביקרתי");

    el.filterSummary.textContent = parts.length ? "מסונן — " + parts.join(" · ") : "";
    el.filterSummary.hidden = parts.length === 0;
  }

  function hasActiveFilters() {
    return Boolean(filters.query.trim()) || filters.area !== "all" || filters.status !== "all";
  }

  /** מאפס את הסינון בלבד — לא נוגע בנתוני הביקור */
  function clearAllFilters(options) {
    filters.query = "";
    filters.area = "all";
    filters.status = "all";
    visibleLimit = PAGE_SIZE;
    flatListPage = 1;

    if (el.search) el.search.value = "";
    if (el.area) el.area.value = "all";

    syncStatusButtons();
    renderFilters();
    renderList();

    if (el.searchStatus) el.searchStatus.textContent = "";
    if (options && options.focus !== false && el.search) el.search.focus();

    announce("הסינון נוקה. מוצגים " + formatNumber(allStreets().length) + " רחובות.");
  }

  /** סינון לפי שכונה מתוך הפילוח או מתוך קיצורי ההתחלה */
  function filterByArea(area) {
    filters.area = area;
    if (el.area) el.area.value = area;
    visibleLimit = PAGE_SIZE;
    flatListPage = 1;
    openAreas.add(area);
    renderFilters();
    var count = renderList();
    announce("מסונן לשכונה " + area + " — " + formatNumber(count) + " רחובות.");
    scrollToList();
  }

  function scrollToList() {
    var title = document.getElementById("list-title");
    if (title && typeof title.scrollIntoView === "function") {
      var top = title.getBoundingClientRect().top;
      title.scrollIntoView({ block: "start", behavior: scrollBehaviorFor(top) });
    }
  }

  function scrollToMap() {
    var section = el.mapSection;
    if (section && typeof section.scrollIntoView === "function") {
      var top = section.getBoundingClientRect().top;
      section.scrollIntoView({ block: "start", behavior: scrollBehaviorFor(top) });
    }
  }

  function render() {
    invalidateStreets();
    rebuildIndex();
    renderStats();
    renderList();
    renderFilters();
  }

  /* ---------- פעולות על שכונות ---------- */

  /** מבטיח שהשכונה תהיה בתוך מגבלת הרינדור */
  function ensureAreaLimit(area) {
    var areas = sortedAreaList();
    for (var i = 0; i < areas.length; i += 1) {
      if (areas[i].area !== area) continue;
      if (i >= areaLimit) {
        areaLimit = Math.ceil((i + 1) / AREA_PAGE_SIZE) * AREA_PAGE_SIZE;
      }
      return;
    }
  }

  /** מחזיר את הפוקוס לכפתור של השכונה אחרי רינדור מחדש */
  function focusAreaControl(area, action) {
    var group = findGroup(area);
    if (!group) return;
    var button = group.querySelector('[data-action="' + (action || "area-focus") + '"]');
    if (!button || button.hidden) button = group.querySelector('[data-action="area-focus"]');
    if (button) button.focus({ preventScroll: true });
  }

  /**
   * לחיצה על שם השכונה: פותח את השכונה וממקד את המפה בה — בלי לסנן את הרשימה
   * ובלי לגלול. החץ הנפרד פותח/סוגר בלבד, בלי להזיז את המפה.
   */
  function focusArea(area) {
    var map = window.JLMMap;
    var ok = false;
    if (map && typeof map.zoomToArea === "function") {
      try {
        ok = map.zoomToArea(area);
      } catch (error) {
        ok = false;
      }
    }
    if (!ok) {
      showToast("המפה אינה זמינה כרגע.");
      announce("המפה אינה זמינה כרגע.");
      return;
    }

    if (!openAreas.has(area)) {
      openAreas.add(area);
      ensureAreaLimit(area);
      renderList();
    }
    focusAreaControl(area, "area-focus");

    /* גלילה למפה כדי שהמשתמש יראה את השכונה שמוקדה */
    scrollToMap();

    announce("ממוקד בשכונה " + area + ".");
  }

  /** החץ: פותח/סוגר בלבד — בלי להזיז את המפה ובלי לסנן */
  function toggleArea(area) {
    var open = openAreas.has(area);
    if (open) {
      openAreas.delete(area);
    } else {
      openAreas.add(area);
      ensureAreaLimit(area);
    }
    renderList();
    focusAreaControl(area, "area-toggle");
    announce(open ? "נסגרו הרחובות של " + area + "." : "נפתחו הרחובות של " + area + ".");
  }

  /**
   * הודעת השלמה/הפחתה — רק בפעולת משתמש, ולא ברינדור.
   * ה-Set בזיכרון מונע חגיגה כפולה באותו סשן.
   * מחזיר null או { kind: "done" | "undone", text }.
   */
  function completionMessage(area, before, after) {
    if (!after.total) return null;
    var wasDone = before.visited >= before.total;
    var isDone = after.visited >= after.total;

    if (!wasDone && isDone) {
      if (celebratedAreas.has(area)) return null;
      celebratedAreas.add(area);
      return { kind: "done", text: "הושלמת את " + area + " — " + after.total + " מתוך " + after.total + "." };
    }

    if (wasDone && !isDone) {
      return {
        kind: "undone",
        text: area + " שוב אינה מושלמת — " + after.visited + " מתוך " + after.total + "."
      };
    }

    return null;
  }

  /** סימון גורפי של כל הרחובות של השכונה — שמירה אחת וביטול אחד */
  function batchMarkArea(area) {
    var pending = streetsInArea(area).filter(function (street) {
      return !isVisited(street.id);
    });
    if (!pending.length) return;

    var confirmed = window.confirm(
      "לסמן כביקרתם את כל הרחובות של שכונה " + area + " שטרם סומנו — " +
        formatNumber(pending.length) + " רחובות? אפשר לבטל את הפעולה אחר כך."
    );
    if (!confirmed) return;

    var before = areaStats(area);
    /* התקדמות כלל-עירית לפני הסימון הגורפי — אבני הדרך נמדדות על כל העיר */
    var cityBefore = cityProgress();
    var batch = [];
    pending.forEach(function (street) {
      batch.push({ id: street.id, prev: null });
      state.visited[street.id] = { date: today(), note: "", rating: 0, mood: "" };
    });

    pushUndo({ batch: batch, name: "סימון " + formatNumber(pending.length) + " רחובות בשכונה " + area });
    persist();

    var after = areaStats(area);
    /* התקדמות כלל-עירית אחרי הסימון הגורפי */
    var cityAfter = cityProgress();
    var completion = completionMessage(area, before, after);
    var text = completion ? completion.text : ("סומנו " + formatNumber(pending.length) + " רחובות בשכונה " + area);

    showToast(text, "בטל סימון השכונה");
    if (completion && completion.kind === "done") {
      celebrate(completion.text);
      speak(completion.text);
    } else {
      speak("סומנו " + formatNumber(pending.length) + " רחובות בשכונה " + area + ".");
    }
    checkMilestones(
      cityBefore.visited, cityBefore.total,
      cityAfter.visited, cityAfter.total
    );
    playSound(completion && completion.kind === "done" ? "complete" : "mark");
    haptic(completion && completion.kind === "done" ? [40, 60, 40] : 15);
    announce(
      text + ". ביקרתם " + formatNumber(cityAfter.visited) + " מתוך " + formatNumber(cityAfter.total) + "."
    );

    renderList();
    renderStats();
    updateAreaUI(area);
    focusAreaControl(area, "batch-mark");

    batch.forEach(function (item) {
      emitVisitedChange(item.id);
    });
  }

  /** סיום ידני של שכונה — המשתמש מצהיר שהשכונה הושלמה */
  function completeAreaManually(area, note) {
    var completedAt = today();
    var prev = Object.prototype.hasOwnProperty.call(state.manualCompletions, area)
      ? { note: state.manualCompletions[area].note, completedAt: state.manualCompletions[area].completedAt }
      : null;
    var noteText = String(note || "").trim().slice(0, MAX_NOTE);
    state.manualCompletions[area] = { note: noteText, completedAt: completedAt };
    pushUndo({
      type: "manual-complete",
      area: area,
      name: area,
      prev: prev
    });
    persist();

    showToast("שכונת " + area + " סומנה כהושלמה ידנית", "בטל את הסיום הידני");
    speak("שכונת " + area + " סומנה כהושלמה ידנית. כל הכבוד!");
    celebrate("שכונת " + area + " הושלמה ידנית!");
    playSound("complete");
    haptic([40, 60, 40]);
    announce("שכונת " + area + " סומנה כהושלמה ידנית.");
    renderList();
    renderStats();
    updateAreaUI(area);
    focusAreaControl(area, "manual-undo");
  }

  /** ביטול סיום ידני של שכונה */
  function undoManualCompletion(area) {
    var confirmed = window.confirm("לבטל את הסיום הידני של שכונת " + area + "?");
    if (!confirmed) return;

    var prev = Object.prototype.hasOwnProperty.call(state.manualCompletions, area)
      ? { note: state.manualCompletions[area].note, completedAt: state.manualCompletions[area].completedAt }
      : null;
    delete state.manualCompletions[area];
    pushUndo({
      type: "manual-complete",
      area: area,
      name: area,
      prev: prev
    });
    persist();

    showToast("הסיום הידני של שכונת " + area + " בוטל", "שחזר את הסיום הידני");
    announce("הסיום הידני של שכונת " + area + " בוטל.");
    renderList();
    renderStats();
    updateAreaUI(area);
    focusAreaControl(area, "manual-complete");
  }

  /** ביטול סימון גורפי של השכונה — שמירה אחת וביטול אחד */
  function batchUnmarkArea(area) {
    var marked = streetsInArea(area).filter(function (street) {
      return isVisited(street.id);
    });
    if (!marked.length) return;

    var confirmed = window.confirm(
      "לבטל את הסימון של כל רחובות שכונה " + area + " — " +
        formatNumber(marked.length) + " רחובות? אפשר לבטל את הפעולה אחר כך."
    );
    if (!confirmed) return;

    var before = areaStats(area);
    var batch = [];
    marked.forEach(function (street) {
      var record = state.visited[street.id];
      batch.push({ id: street.id, prev: { date: record.date, note: record.note, rating: record.rating, mood: record.mood } });
      delete state.visited[street.id];
    });

    pushUndo({ batch: batch, name: "ביטול הסימון של " + formatNumber(marked.length) + " רחובות בשכונה " + area });
    persist();

    var after = areaStats(area);
    var completion = completionMessage(area, before, after);
    var text = completion ? completion.text : ("בוטל הסימון של " + formatNumber(marked.length) + " רחובות בשכונה " + area);

    showToast(text, "החזר את הסימון");
    announce(
      text + ". ביקרתם " + formatNumber(countVisited()) + " מתוך " + formatNumber(allStreets().length) + "."
    );

    renderList();
    renderStats();
    updateAreaUI(area);
    focusAreaControl(area, "batch-unmark");

    batch.forEach(function (item) {
      emitVisitedChange(item.id);
    });
  }

  /** מעדכן את מוני השכונה ואת הפס — בלי לקפל את השכונה ובלי לרנדר מחדש */
  function updateAreaUI(area) {
    var group = findGroup(area);
    if (!group) return;

    var stats = areaStats(area);
    var percent = percentValue(stats.visited, stats.total);
    var done = stats.total > 0 && stats.visited >= stats.total;
    /* הסיום הידני מחושב לפני עדכון התג — אחרת התג יישאר שגוי או ייעלם */
    var manual = Boolean(state.manualCompletions && state.manualCompletions[area]);

    var count = group.querySelector(".area-group__count");
    if (count) count.textContent = stats.visited + "/" + stats.total;

    var nameButton = group.querySelector(".area-group__name");
    if (nameButton) {
      nameButton.setAttribute(
        "aria-label",
        areaLabel(area, stats.visited, stats.total, stats.total - stats.visited, manual)
      );
    }

    var pct = group.querySelector(".area-group__pct");
    if (pct) pct.textContent = percentText(stats.visited, stats.total);

    var bar = group.querySelector(".area-group__bar > span");
    if (bar) bar.style.width = percent.toFixed(2) + "%";

    updateAreaBadge(group.querySelector(".area-group__badge"), done, manual);

    if (done) group.classList.add("is-done");
    else group.classList.remove("is-done");

    var card = group.querySelector(".area-card");
    if (!card) return;

    var title = card.querySelector(".area-card__title");
    if (title) {
      title.textContent =
        "שכונת " + area + ": " + stats.visited + " מתוך " + stats.total + " רחובות סומנו — " +
        percentText(stats.visited, stats.total) + (manual ? " · הושלמה ידנית" : "");
    }

    var cardBar = card.querySelector(".area-card__bar > span");
    if (cardBar) cardBar.style.width = percent.toFixed(2) + "%";

    var actions = card.querySelector(".area-card__actions");
    if (!actions) return;

    var mark = actions.querySelector('[data-action="batch-mark"]');
    if (mark) mark.hidden = stats.visited >= stats.total;

    var unmark = actions.querySelector('[data-action="batch-unmark"]');
    if (unmark) unmark.hidden = stats.visited === 0;

    var manualComplete = actions.querySelector('[data-action="manual-complete"]');
    if (manualComplete) manualComplete.hidden = manual;

    var manualUndo = actions.querySelector('[data-action="manual-undo"]');
    if (manualUndo) manualUndo.hidden = !manual;
  }

  /* ---------- ניווט לרחוב ---------- */

  /** לחיצה על שורת רחוב או על שמו — קפיצה למפה בזום 16. לא מסמן. */
  function gotoStreet(id) {
    var street = findStreet(id);
    if (!street) return false;

    var map = window.JLMMap;
    var ok = false;
    if (map && typeof map.zoomToStreet === "function") {
      try {
        ok = map.zoomToStreet(id, 16);
      } catch (error) {
        ok = false;
      }
    }

    highlightRow(id);
    scrollToMap();

    if (!ok) {
      showToast("המפה אינה זמינה כרגע — אפשר לפתוח את הרחוב ב-Google Maps.");
      announce("המפה אינה זמינה כרגע.");
      return true;
    }

    announce("ממקד את המפה ברחוב " + street.name + ".");
    return true;
  }

  function highlightRow(id) {
    var row = findRow(id);
    if (!row) return;

    var previous = el.list.querySelector(".street.is-highlighted");
    if (previous) previous.classList.remove("is-highlighted");

    row.classList.add("is-highlighted");
    window.clearTimeout(highlightTimer);
    // Don't auto-clear - will be cleared by clicking anywhere on screen
  }

  /** מחזיר מיקוד לפעולה מסוימת בשורה — למשל אחרי שסימון ביקור מחליף את השורה */
  function restoreRowAction(id, action) {
    var row = findRow(id);
    var button = row ? row.querySelector('[data-action="' + action + '"]') : null;
    if (button) {
      button.focus({ preventScroll: true });
      return;
    }
    el.list.focus({ preventScroll: true });
  }

  function restoreFocus(id) {
    var row = findRow(id);
    if (row) {
      var button = row.querySelector('[data-action="goto"]');
      if (button) {
        button.focus({ preventScroll: true });
        return;
      }
    }
    el.list.focus({ preventScroll: true });
  }

  /**
   * ממקד רחוב מהמפה: מאפס סינון אם צריך, פותח את השכונה של הרחוב,
   * גולל לשורה ומדגיש אותה — בלי לסמן.
   */
  function focusStreet(id) {
    var street = findStreet(id);
    if (!street) return false;

    var area = street.area || "אחר";
    var visible = visibleStreets().some(function (item) {
      return item.id === id;
    });

    if (!visible) {
      filters.query = "";
      filters.area = "all";
      filters.status = "all";
      if (el.search) el.search.value = "";
      if (el.area) el.area.value = "all";
      syncStatusButtons();
      visibleLimit = PAGE_SIZE;
      renderFilters();
    }

    if (!isFlatMode()) {
      if (!openAreas.has(area)) openAreas.add(area);
      ensureAreaLimit(area);
    } else {
      /* בתצוגה שטוחה ייתכן שהרחוב מעבר לגבול העימוד — מרחיבים אותו */
      var flat = flatStreets();
      for (var i = 0; i < flat.length; i += 1) {
        if (flat[i].id !== id) continue;
        if (i >= visibleLimit) {
          visibleLimit = Math.ceil((i + 1) / PAGE_SIZE) * PAGE_SIZE;
        }
        break;
      }
    }

    renderList();

    var row = findRow(id);
    if (!row) return false;

    if (typeof row.scrollIntoView === "function") {
      var offset = row.getBoundingClientRect().top;
      row.scrollIntoView({ block: "center", behavior: scrollBehaviorFor(offset) });
    }
    highlightRow(id);

    var button = row.querySelector('[data-action="goto"]');
    if (button) button.focus({ preventScroll: true });

    return true;
  }

  /** מחליף שורה אחת ב-DOM בלי לרנדר מחדש את כל הרשימה */
  function refreshRow(id) {
    var street = findStreet(id);
    var row = findRow(id);
    if (!street || !row) return null;

    var host = document.createElement("div");
    host.innerHTML = streetRow(street);
    var next = host.firstElementChild;
    if (!next) return null;

    row.replaceWith(next);
    return next;
  }

  function pushUndo(entry) {
    undoStack.push(entry);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }

  function toggleStreet(id, options) {
    var street = findStreet(id);
    if (!street) return;

    var area = street.area || "אחר";
    var before = areaStats(area);
    /* התקדמות כלל-עירית לפני השינוי — אבני הדרך נמדדות על כל העיר, לא על השכונה */
    var cityBefore = cityProgress();

    /* עותק לפני השינוי — מאפשר לבטל את הפעולה ולהחזיר תאריך והערה */
    var wasVisited = isVisited(id);
    var prev = wasVisited
      ? { date: state.visited[id].date, note: state.visited[id].note, rating: state.visited[id].rating, mood: state.visited[id].mood }
      : null;

    var message;
    if (wasVisited) {
      delete state.visited[id];
      message = "הביקור ב" + street.name + " בוטל";
    } else {
      state.visited[id] = { date: today(), note: "", rating: 0, mood: "" };
      message = "סומן ביקור ב" + street.name;
    }

    /* התקדמות כלל-עירית אחרי השינוי — הבסיס לאבני הדרך */
    var cityAfter = cityProgress();

    pushUndo({ id: id, name: street.name, prev: prev });

    persist();

    var after = areaStats(area);
    var completion = completionMessage(area, before, after);
    /* השלמה = ההודעה עצמה; הפחתה = תוספת להודעה הקיימת */
    var text;
    if (completion && completion.kind === "done") {
      text = completion.text;
    } else if (completion && completion.kind === "undone") {
      text = message + ". " + completion.text;
    } else {
      text = message;
    }

    announce(
      text +
        ". ביקרתם " + formatNumber(cityAfter.visited) + " מתוך " + formatNumber(cityAfter.total) +
        ". אפשר לבטל את הפעולה."
    );
    showToast(text, wasVisited ? "החזר את הביקור" : "בטל את הסימון");

    /* חיווי קולי וחגיגה — רק כשמסמנים (לא כשמבטלים) */
    if (!wasVisited) {
      if (completion && completion.kind === "done") {
        celebrate(completion.text);
        speak(completion.text);
      } else {
        speak("סומן ביקור ברחוב " + street.name + ".");
      }
      checkMilestones(
        cityBefore.visited, cityBefore.total,
        cityAfter.visited, cityAfter.total
      );
      playSound(completion && completion.kind === "done" ? "complete" : "mark");
      haptic(completion && completion.kind === "done" ? [40, 60, 40] : 15);
    }

    /* עדכון מלא — מבטיח סנכרון מלא בין state ל-DOM */
    renderList();
    renderStats();
    renderFilters();
    if (options && options.focusAction) restoreRowAction(id, options.focusAction);
    emitVisitedChange(id);
  }

  /** מסיר הערה שממתינה לשמירה, כדי שלא תיכתב לרחוב שנמחק */
  function forgetPendingNote(id) {
    if (pendingNoteTimers[id]) {
      window.clearTimeout(pendingNoteTimers[id]);
      delete pendingNoteTimers[id];
    }
    delete pendingNoteValues[id];
  }

  /**
   * מחיקה ידנית של רחוב: הרשומה נשארת ב-data.js, אבל המזהה נכנס ל-state.deleted.
   * כך הרחוב יורד מהרשימה, מהספירות ומהמפה, ואפשר לשחזר אותו עם "בטל".
   */
  function deleteStreet(id) {
    var street = findStreet(id);
    if (!street || isDeleted(id)) return false;

    var confirmed = window.confirm(
      "למחוק את " + street.name + " מהרשימה ומהמפה? הביקור וההערה יישמרו, ואפשר לבטל מיד."
    );
    if (!confirmed) return false;

    var area = street.area || "אחר";
    forgetPendingNote(id);
    state.deleted.push(id);
    deletedIds.add(id);
    invalidateStreets();

    if (!streetsInArea(area).length) openAreas.delete(area);

    pushUndo({ deleteStreet: { id: id, name: street.name } });
    persist();

    render();
    emitStreetsChange();
    el.list.focus({ preventScroll: true });

    var text = "נמחק " + street.name + " מהרשימה ומהמפה";
    showToast(text, "בטל את המחיקה");
    announce(text + ". אפשר לבטל את הפעולה.");
    return true;
  }

  /* ---------- ביטול פעולה (בזיכרון בלבד) ---------- */

  function showToast(message, undoLabel) {
    if (!el.toast) return;
    /* לפני שההתראה מופיעה — שומרים את מקום הפוקוס, כדי להחזיר אליו אם ההתראה
       נסגרת (או מתפוגשת) בזמן שהפוקוס היה בתוך ההתראה */
    if (el.toast.hidden) {
      var active = document.activeElement;
      toastReturnFocus = active && active !== document.body ? active : null;
    }
    el.toastText.textContent = message;
    if (undoLabel) {
      el.toastUndo.textContent = undoLabel;
      el.toastUndo.hidden = false;
    } else {
      el.toastUndo.hidden = true;
    }
    el.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(hideToast, TOAST_TIMEOUT);
  }

  function hideToast() {
    window.clearTimeout(toastTimer);
    if (!el.toast) return;
    var hadFocus = el.toast.contains(document.activeElement);
    el.toast.hidden = true;
    if (!hadFocus) return;
    /* הפוקוס היה בתוך ההתראה שנסגרה — מחזירים אותו למקום שממנו יצא */
    var back = toastReturnFocus;
    toastReturnFocus = null;
    if (back && back.parentNode && typeof back.focus === "function") {
      back.focus({ preventScroll: true });
    } else if (el.list) {
      el.list.focus({ preventScroll: true });
    }
  }

  /** מחזיר את הרחובים למצבם לפני הפעולה האחרונה — כולל תאריך והערה */
  function undoLastAction() {
    var entry = undoStack.pop();
    if (!entry) {
      announce("אין פעולה שאפשר לבטל.");
      return;
    }

    /* סיום ידני — משחזר את הרשומה הקודמת או מסיר אותה, בלי לגעת בביקורים */
    if (entry.type === "manual-complete") {
      if (entry.prev) {
        state.manualCompletions[entry.area] = {
          note: entry.prev.note || "",
          completedAt: entry.prev.completedAt || today()
        };
      } else {
        delete state.manualCompletions[entry.area];
      }

      persist();
      hideToast();
      ensureAreaLimit(entry.area);
      renderList();
      renderStats();
      updateAreaUI(entry.area);
      focusAreaControl(entry.area, entry.prev ? "manual-undo" : "manual-complete");
      announce(
        "הפעולה בוטלה. הסיום הידני של שכונת " + entry.area +
          (entry.prev ? " שוחזר." : " בוטל.")
      );
      return;
    }

    /* מחיקה ידנית — מחזיר את המזהה לרשימת הפעילים, כולל הביקור וההערה שנשמרו */
    if (entry.deleteStreet) {
      var deletedId = entry.deleteStreet.id;
      var deletedIndex = state.deleted.indexOf(deletedId);
      if (deletedIndex !== -1) state.deleted.splice(deletedIndex, 1);
      deletedIds.delete(deletedId);
      invalidateStreets();
      persist();
      hideToast();
      render();
      emitStreetsChange();
      restoreRowAction(deletedId, "delete-street");
      announce("הפעולה בוטלה. " + entry.deleteStreet.name + " חזר לרשימה ולמפה.");
      return;
    }

    /* פעולה מקובצת — פעולה גורפת על שכונה */
    if (entry.batch) {
      entry.batch.forEach(function (item) {
        if (item.prev) {
          state.visited[item.id] = { date: item.prev.date, note: item.prev.note, rating: item.prev.rating || 0, mood: item.prev.mood || "" };
        } else if (Object.prototype.hasOwnProperty.call(state.visited, item.id)) {
          delete state.visited[item.id];
        }
      });

      persist();
      hideToast();
      renderList();
      renderStats();

      var batchArea = null;
      if (entry.batch.length) {
        var firstStreet = findStreet(entry.batch[0].id);
        if (firstStreet) batchArea = firstStreet.area || "אחר";
      }
      if (batchArea) focusAreaControl(batchArea, "area-toggle");

      entry.batch.forEach(function (item) {
        emitVisitedChange(item.id);
      });

      announce("הפעולה בוטלה. " + (entry.name || "הרחובות חזרו למצבם הקודם."));
      return;
    }

    if (entry.prev) {
      state.visited[entry.id] = { date: entry.prev.date, note: entry.prev.note, rating: entry.prev.rating || 0, mood: entry.prev.mood || "" };
    } else if (Object.prototype.hasOwnProperty.call(state.visited, entry.id)) {
      delete state.visited[entry.id];
    }

    persist();
    hideToast();

    if (filters.status === "all") {
      if (findRow(entry.id)) refreshRow(entry.id);
    } else {
      renderList();
    }

    var street = findStreet(entry.id);
    if (street) updateAreaUI(street.area || "אחר");
    renderStats();
    restoreFocus(entry.id);
    emitVisitedChange(entry.id);
    announce("הפעולה בוטלה. " + entry.name + " חזר למצבו הקודם.");
  }

  function updateRecord(id, field, value) {
    var record = state.visited[id];
    if (!record) return;
    record[field] = value;
    persist();
    renderStats();
  }

  function syncStatusButtons() {
    el.statusButtons.forEach(function (button) {
      var active = button.dataset.status === filters.status;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function downloadExport() {
    var blob = new Blob([Store.toJSON(state)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "jlm-streets-" + today() + ".json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
    announce("הקובץ יוצא בהצלחה");
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var result = Store.fromJSON(String(reader.result || ""));
      if (!result.ok) {
        showBanner("הייבוא נכשל: " + result.error + " הנתונים הקיימים לא שונו.");
        announce("הייבוא נכשל");
        return;
      }
      var confirmed = window.confirm("הייבוא יחליף את הנתונים הנוכחיים. להמשיך?");
      if (!confirmed) return;

      clearNoteTimers();
      state = result.state;
      deletedIds = new Set(state.deleted || []);
      undoStack.length = 0;
      hideToast();
      invalidateStreets();
      visibleLimit = PAGE_SIZE;
      celebratedAreas.clear();
      milestoneReached = Object.create(null);
      if (el.voiceToggle) {
        el.voiceToggle.setAttribute("aria-pressed", settings().voice ? "true" : "false");
        el.voiceToggle.classList.toggle("is-active", settings().voice);
      }
      if (el.soundToggle) {
        el.soundToggle.setAttribute("aria-pressed", settings().sound ? "true" : "false");
        el.soundToggle.classList.toggle("is-active", settings().sound);
      }

      // מונע התנגשות בין מזהה מיובא למזהה של רחוב בסיס (שתי שורות עם אותו data-id)
      var baseIds = Object.create(null);
      BASE_STREETS.forEach(function (street) {
        baseIds[street.id] = true;
      });
      state.custom = state.custom.filter(function (street) {
        return !baseIds[street.id];
      });

      persist();
      render();
      emitVisitedReplace();
      announce("הייבוא הושלם");
    };
    reader.onerror = function () {
      announce("לא ניתן לקרוא את הקובץ");
    };
    reader.readAsText(file);
  }

  /* ---------- אירועים ---------- */

  el.search.addEventListener("input", function (event) {
    filters.query = event.target.value;
    visibleLimit = PAGE_SIZE;
    flatListPage = 1;
    renderFilters();
    window.clearTimeout(searchRenderTimer);
    searchRenderTimer = window.setTimeout(function () {
      var count = renderList();
      announceResults(count);
    }, SEARCH_DEBOUNCE);
  });

  /* Enter בשדה החיפוש — קפיצה לרחוב הראשון בתוצאות */
  el.search.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    event.preventDefault();

    var list = visibleStreets();
    if (!list.length) {
      announce("אין תוצאות לקפיצה");
      return;
    }
    gotoStreet(list[0].id);
  });

  if (el.searchClear) {
    el.searchClear.addEventListener("click", function () {
      el.search.value = "";
      filters.query = "";
      visibleLimit = PAGE_SIZE;
      flatListPage = 1;
      renderFilters();
      renderList();
      if (el.searchStatus) el.searchStatus.textContent = "";
      el.search.focus();
      announce("החיפוש נוקה. מוצגים " + formatNumber(allStreets().length) + " רחובות.");
    });
  }

  if (el.resultCount) {
    el.resultCount.addEventListener("click", scrollToList);
  }

  if (el.clearFiltersBtn) {
    el.clearFiltersBtn.addEventListener("click", function () {
      clearAllFilters({ focus: true });
    });
  }

  el.empty.addEventListener("click", function (event) {
    var button = event.target.closest('[data-action="clear-filters"]');
    if (!button) return;
    clearAllFilters({ focus: true });
  });

  /* קיצורי ההתחלה ופירוט השכונות מגדירים את הסינון */
  function bindAreaButtons(container) {
    if (!container) return;
    container.addEventListener("click", function (event) {
      var button = event.target.closest("[data-area]");
      if (!button) return;
      filterByArea(button.dataset.area);
    });
  }

  bindAreaButtons(el.breakdown);

  el.area.addEventListener("change", function (event) {
    filters.area = event.target.value;
    visibleLimit = PAGE_SIZE;
    if (filters.area !== "all") {
      openAreas.add(filters.area);
      ensureAreaLimit(filters.area);
    }
    renderFilters();
    renderList();
    announce(
      filters.area === "all"
        ? "מוצגות כל השכונות"
        : "מסונן לשכונה " + filters.area + " — " + formatNumber(visibleStreets().length) + " רחובות."
    );
  });

  if (el.areaSort) {
    el.areaSort.addEventListener("change", function (event) {
      sortMode = event.target.value;
      renderList();
      var label = el.areaSort.options[el.areaSort.selectedIndex].text;
      announce("השכונות ממוינות: " + label + ".");
    });
  }

  if (el.streetSort) {
    el.streetSort.addEventListener("change", function () {
      streetSortMode = el.streetSort.value;
      flatListPage = 1;
      renderList();
      announce("הרחובות ממוינים לפי שם: " + el.streetSort.options[el.streetSort.selectedIndex].text + ".");
    });
  }

  el.viewButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setListView(button.dataset.view);
    });
  });

  el.statusButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      filters.status = button.dataset.status;
      visibleLimit = PAGE_SIZE;
      flatListPage = 1;
      syncStatusButtons();
      renderFilters();
      renderList();
    });
  });

  el.list.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== "function") return;

    // Flat list pagination
    var flatPrev = target.closest('[data-action="flat-prev"]');
    if (flatPrev) {
      flatListPage = Math.max(1, flatListPage - 1);
      renderList();
      announce("עמוד " + flatListPage);
      return;
    }

    var flatNext = target.closest('[data-action="flat-next"]');
    if (flatNext) {
      var streets = flatStreets();
      var totalPages = Math.ceil(streets.length / PAGE_SIZE);
      flatListPage = Math.min(totalPages, flatListPage + 1);
      renderList();
      announce("עמוד " + flatListPage);
      return;
    }

    var moreAreas = target.closest('[data-action="more-areas"]');
    if (moreAreas) {
      areaLimit += AREA_PAGE_SIZE;
      renderList();
      announce("מוצגות עד " + formatNumber(areaLimit) + " שכונות");
      var nextAreaButton = el.list.querySelector('[data-action="more-areas"]');
      if (nextAreaButton) nextAreaButton.focus({ preventScroll: true });
      return;
    }

    var areaFocus = target.closest('[data-action="area-focus"]');
    if (areaFocus) {
      event.preventDefault();
      focusArea(areaFocus.dataset.area);
      return;
    }

    var areaToggle = target.closest('[data-action="area-toggle"]');
    if (areaToggle) {
      event.preventDefault();
      toggleArea(areaToggle.dataset.area);
      return;
    }

    var batchMark = target.closest('[data-action="batch-mark"]');
    if (batchMark) {
      event.preventDefault();
      batchMarkArea(batchMark.dataset.area);
      return;
    }

    var batchUnmark = target.closest('[data-action="batch-unmark"]');
    if (batchUnmark) {
      event.preventDefault();
      batchUnmarkArea(batchUnmark.dataset.area);
      return;
    }

    var remove = target.closest('[data-action="delete-street"]');
    if (remove) {
      event.preventDefault();
      var deleteRow = remove.closest("[data-id]");
      if (deleteRow) deleteStreet(deleteRow.dataset.id);
      return;
    }

    var rate = target.closest('[data-action="rate"]');
    if (rate) {
      event.preventDefault();
      var rateRow = rate.closest(".street");
      if (rateRow) {
        var rid = rateRow.dataset.id;
        var rating = Number(rate.dataset.rating) || 0;
        if (state.visited[rid]) {
          state.visited[rid].rating = rating;
          persist();
          var stars = rateRow.querySelectorAll('.street__star');
          stars.forEach(function (star) {
            var n = Number(star.dataset.rating) || 0;
            var on = n <= rating;
            star.classList.toggle("is-on", on);
            star.setAttribute("aria-pressed", on ? "true" : "false");
            star.textContent = on ? "★" : "☆";
          });
        }
      }
      return;
    }

    var mood = target.closest('[data-action="mood"]');
    if (mood) {
      event.preventDefault();
      var moodRow = mood.closest(".street");
      if (moodRow) {
        var mid = moodRow.dataset.id;
        var moodVal = mood.dataset.mood;
        if (state.visited[mid]) {
          state.visited[mid].mood = moodVal;
          persist();
          var chips = moodRow.querySelectorAll(".street__mood");
          chips.forEach(function (chip) {
            var on = chip.dataset.mood === moodVal;
            chip.classList.toggle("is-on", on);
            chip.setAttribute("aria-pressed", on ? "true" : "false");
          });
        }
      }
      return;
    }

    var visit = target.closest('[data-action="toggle-visit"]');
    if (visit) {
      event.preventDefault();
      var visitRow = visit.closest("[data-id]");
      if (visitRow) {
        toggleStreet(visitRow.dataset.id, { focusAction: "toggle-visit" });
      }
      return;
    }

    var goto = target.closest('[data-action="goto"]');
    if (goto) {
      event.preventDefault();
      var gotoRow = goto.closest("[data-id]");
      if (gotoRow) gotoStreet(gotoRow.dataset.id);
      return;
    }

    var manualComplete = target.closest('[data-action="manual-complete"]');
    if (manualComplete) {
      event.preventDefault();
      var area = manualComplete.dataset.area;
      var note = prompt("הערה לסיום ידני (אופציונלי):");
      if (note === null) return; // cancelled
      completeAreaManually(area, note);
      return;
    }

    var manualUndo = target.closest('[data-action="manual-undo"]');
    if (manualUndo) {
      event.preventDefault();
      var area = manualUndo.dataset.area;
      undoManualCompletion(area);
      return;
    }

    /* קליק על שורת רחוב — ניווט למפה. קישורים ושדות לא מפעילים את הקפיצה. */
    var row = target.closest(".street[data-id]");
    if (!row) return;
    if (target.closest("a, input, textarea, select, button, label")) return;
    gotoStreet(row.dataset.id);
  });

  el.list.addEventListener("change", function (event) {
    var input = event.target;
    var action = input.dataset.action;
    if (action !== "date" && action !== "note") return;

    var row = input.closest("[data-id]");
    if (!row) return;

    var field = action === "date" ? "date" : "note";
    updateRecord(row.dataset.id, field, input.value);
  });

  el.list.addEventListener("input", function (event) {
    var input = event.target;
    if (input.dataset.action !== "note") return;

    var row = input.closest("[data-id]");
    if (!row) return;

    var id = row.dataset.id;
    pendingNoteValues[id] = input.value;

    window.clearTimeout(pendingNoteTimers[id]);
    pendingNoteTimers[id] = window.setTimeout(function () {
      var value = pendingNoteValues[id];
      delete pendingNoteValues[id];
      delete pendingNoteTimers[id];
      if (typeof value === "string") updateRecord(id, "note", value);
    }, NOTE_SAVE_DELAY);
  });

  el.exportBtn.addEventListener("click", downloadExport);

  el.importBtn.addEventListener("click", function () {
    el.importInput.click();
  });

  el.importInput.addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    if (file) importFile(file);
    event.target.value = "";
  });

  el.addForm.addEventListener("submit", function (event) {
    event.preventDefault();

    var name = el.addName.value.trim();
    if (!name) {
      el.addName.focus();
      return;
    }

    var area = el.addArea.value.trim() || "אחר";
    var baseId = "custom-" + normalize(name).replace(/\s+/g, "-").replace(/[^a-z0-9\u0590-\u05FF-]/g, "");
    var id = baseId || "custom-" + Date.now();
    var suffix = 2;

    while (
      allKnownStreets().some(function (street) {
        return street.id === id;
      })
    ) {
      id = baseId + "-" + suffix;
      suffix += 1;
    }

    state.custom.push({ id: id, name: name, area: area });
    invalidateStreets();

    if (!persist()) {
      state.custom.pop();
      invalidateStreets();
      announce("ההוספה נשפלה — לא ניתן לשמור");
      return;
    }

    el.addForm.reset();
    filters.area = "all";
    filters.status = "all";
    filters.query = "";
    visibleLimit = PAGE_SIZE;
    el.search.value = "";
    syncStatusButtons();
    render();
    announce("נוסף " + name);
  });

  if (el.toastUndo) {
    el.toastUndo.addEventListener("click", undoLastAction);
  }
  if (el.listClear) {
    el.listClear.addEventListener("click", function () {
      clearAllFilters({ focus: false });
      scrollToList();
    });
  }
  if (el.toastClose) {
    el.toastClose.addEventListener("click", hideToast);
  }

  if (el.voiceToggle) {
    el.voiceToggle.setAttribute("aria-pressed", settings().voice ? "true" : "false");
    el.voiceToggle.classList.toggle("is-active", settings().voice);
    el.voiceToggle.addEventListener("click", function () {
      setVoice(!settings().voice);
    });
  }
  if (el.soundToggle) {
    el.soundToggle.setAttribute("aria-pressed", settings().sound ? "true" : "false");
    el.soundToggle.classList.toggle("is-active", settings().sound);
    el.soundToggle.addEventListener("click", function () {
      setSound(!settings().sound);
    });
  }
  if (el.themeToggle) {
    syncThemeButton();
    el.themeToggle.addEventListener("click", function () {
      toggleTheme();
    });
    /* שינוי העדפת המערכת — הכפתור מתעדכן כל עוד המשתמש לא בחר ידנית */
    if (themeMedia) {
      var onSchemeChange = function () {
        if (!themeOverride) {
          syncThemeButton();
          syncThemeColor();
        }
      };
      if (typeof themeMedia.addEventListener === "function") {
        themeMedia.addEventListener("change", onSchemeChange);
      } else if (typeof themeMedia.addListener === "function") {
        themeMedia.addListener(onSchemeChange);
      }
    }
  }
  if (el.randomBtn) {
    el.randomBtn.addEventListener("click", suggestRandomStreet);
  }

  /* ---------- קיצורי מקלדת ---------- */

  /**
   * חיצים — שני מסלולים:
   * 1. בתוך קבוצת כפתורים (סינון/תצוגה): תנועה בין הכפתורים. ב-RTL, שמאל = הבא.
   * 2. בתוך רשימת הרחובות: תנועה בין שורות (כותרות שכונות ושמות רחובות).
   * מחזיר true אם האירוע נטפל ויש למנוע את ההתנהגות הרגילה של הדפדפן.
   */
  function handleArrowNavigation(event, isEditable) {
    if (isEditable) return false;
    var key = event.key;
    if (
      key !== "ArrowDown" && key !== "ArrowUp" && key !== "Home" && key !== "End" &&
      key !== "ArrowLeft" && key !== "ArrowRight"
    ) return false;

    var active = document.activeElement;
    if (!active || !active.closest) return false;

    /* 1. קבוצת כפתורים */
    var group = active.closest(".segmented");
    if (group && (key === "ArrowLeft" || key === "ArrowRight")) {
      var buttons = Array.prototype.slice.call(group.querySelectorAll(".segmented__btn"));
      var index = buttons.indexOf(active);
      if (index === -1) return false;
      var step = key === "ArrowLeft" ? 1 : -1;
      var next = buttons[(index + step + buttons.length) % buttons.length];
      if (!next) return false;
      event.preventDefault();
      next.focus();
      return true;
    }

    /* 2. רשימת הרחובות */
    if (key === "ArrowLeft" || key === "ArrowRight") return false;
    if (!el.list || !el.list.contains(active)) return false;

    var items = Array.prototype.slice.call(el.list.querySelectorAll(".area-group__name, .street__name"));
    if (!items.length) return false;

    var current = items.indexOf(active);
    if (current === -1) {
      /* הפוקוס על כפתור אחר בשורה (סימון/מחיקה) — עוברים לשורה הזאת */
      var host = active.closest(".area-group, .street");
      var nameButton = host ? host.querySelector(".area-group__name, .street__name") : null;
      current = items.indexOf(nameButton);
    }
    if (current === -1) return false;

    var targetIndex;
    if (key === "ArrowDown") targetIndex = current + 1;
    else if (key === "ArrowUp") targetIndex = current - 1;
    else if (key === "Home") targetIndex = 0;
    else if (key === "End") targetIndex = items.length - 1;
    else return false;

    if (targetIndex < 0 || targetIndex >= items.length) return false;
    event.preventDefault();
    var target = items[targetIndex];
    target.focus({ preventScroll: true });
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "nearest" });
    }
    return true;
  }

  /** פותח/סוגר את רשימת קיצורי המקלדת ומעביר אליה את הפוקוס */
  function toggleShortcuts() {
    var box = document.getElementById("shortcuts-details");
    if (!box) return;
    box.open = !box.open;
    var summary = box.querySelector("summary");
    if (box.open && summary) summary.focus();
    announce(box.open ? "רשימת קיצורי המקלדת נפתחה." : "רשימת קיצורי המקלדת נסגרה.");
  }

  /**
   * קיצורי מקלדת — לפי מקש פיזי (event.code) ולא רק לפי התו שמודפס עליו.
   * כך הקיצורים עובדים גם עם מקלדת עברית, שבה התו המודפס הוא עברי.
   * "/" ו"?" זהים בכל פריסת מקלדת, ולכן הם נבדקים לפי event.key בלבד.
   */
  var SHORTCUT_BY_KEY = {
    "/": "search",
    "?": "help",
    r: "random",
    m: "voice",
    s: "sound",
    v: "visit",
    u: "undo",
    t: "theme",
    n: "clear"
  };

  var SHORTCUT_BY_CODE = {
    KeyR: "random",
    KeyM: "voice",
    KeyS: "sound",
    KeyV: "visit",
    KeyU: "undo",
    KeyT: "theme",
    KeyN: "clear"
  };

  /** מזהה את הפעולה המבוקשת לפי האירוע; null אם אין קיצור מתאים */
  function shortcutFor(event) {
    var key = typeof event.key === "string" ? event.key.toLowerCase() : "";
    if (key && Object.prototype.hasOwnProperty.call(SHORTCUT_BY_KEY, key)) return SHORTCUT_BY_KEY[key];
    var code = event.code || "";
    if (code && Object.prototype.hasOwnProperty.call(SHORTCUT_BY_CODE, code)) return SHORTCUT_BY_CODE[code];
    return null;
  }

  document.addEventListener("keydown", function (event) {
    if (event.defaultPrevented) return;

    var target = event.target;
    var tag = target && target.tagName ? target.tagName.toLowerCase() : "";
    var isEditable =
      tag === "input" || tag === "textarea" || tag === "select" || (target && target.isContentEditable);

    /* חיצים — תנועה בין שורות הרשימה ובין כפתורי קבוצת הסינון */
    if (handleArrowNavigation(event, isEditable)) return;

    /* קיצורים פועלים רק מחוץ לשדות טקסט וללא Ctrl/Alt/מטא */
    var shortcut = (!isEditable && !event.ctrlKey && !event.metaKey && !event.altKey)
      ? shortcutFor(event)
      : null;

    /* "/" — מעבר לשדה החיפוש */
    if (shortcut === "search") {
      event.preventDefault();
      el.search.focus();
      el.search.select();
      return;
    }

    /* "r" — רחוב אקראי */
    if (shortcut === "random") {
      event.preventDefault();
      suggestRandomStreet();
      return;
    }

    /* "m" — חיווי קולי */
    if (shortcut === "voice") {
      event.preventDefault();
      setVoice(!settings().voice);
      return;
    }

    /* "s" — צלילים */
    if (shortcut === "sound") {
      event.preventDefault();
      setSound(!settings().sound);
      return;
    }

    /* "t" — מעבר בין מצב בהיר למצב כהה */
    if (shortcut === "theme") {
      event.preventDefault();
      toggleTheme();
      return;
    }

    /* "n" — ניקוי הסינון */
    if (shortcut === "clear") {
      event.preventDefault();
      if (hasActiveFilters()) {
        clearAllFilters({ focus: false });
      } else {
        announce("אין סינון פעיל לניקוי.");
      }
      return;
    }

    /* "v" — סימון/ביטול ביקור של הרחוב במיקוד */
    if (shortcut === "visit") {
      var focusedRow = document.activeElement && document.activeElement.closest
        ? document.activeElement.closest(".street")
        : null;
      if (!focusedRow) {
        focusedRow = el.list.querySelector(".street.is-highlighted");
      }
      if (focusedRow && focusedRow.dataset.id) {
        event.preventDefault();
        toggleStreet(focusedRow.dataset.id, { focusAction: "toggle-visit" });
      }
      return;
    }

    /* "u" או Ctrl+Z — ביטול הפעולה האחרונה (גם כשה-toast כבר נסגר) */
    if (
      (shortcut === "undo" ||
        (event.ctrlKey && (event.key === "z" || event.key === "Z" || event.code === "KeyZ"))) &&
      !isEditable && !event.metaKey && !event.altKey
    ) {
      event.preventDefault();
      undoLastAction();
      return;
    }

    /* "?" — פתיחה וסגירה של רשימת הקיצורים */
    if (shortcut === "help") {
      event.preventDefault();
      toggleShortcuts();
      return;
    }


    if (event.key !== "Escape") return;

    /* Esc בתוך שדה החיפוש — מנקה את החיפוש או את הסינון (לא סוגר את ההתראה) */
    if (document.activeElement === el.search) {
      event.preventDefault();
      if (el.search.value) {
        el.search.value = "";
        filters.query = "";
        visibleLimit = PAGE_SIZE;
        renderFilters();
        renderList();
        if (el.searchStatus) el.searchStatus.textContent = "";
        announce("החיפוש נוקה. מוצגים " + formatNumber(allStreets().length) + " רחובות.");
      } else if (hasActiveFilters()) {
        clearAllFilters({ focus: false });
      }
      return;
    }

    /* Esc מחוץ לשדות טקסט — סוגר קודם את ההתראה (בלי לבטל את הפעולה) */
    if (!isEditable && el.toast && !el.toast.hidden) {
      event.preventDefault();
      hideToast();
      announce("ההתראה נסגרה.");
      return;
    }

    /* Esc — סוגר חלונית מקופלת פתוחה (רשימת הקיצורים או טופס ההוספה) לפני ניקוי הסינון */
    if (!isEditable) {
      var openBox = document.querySelector("#shortcuts-details[open], .add-wrap[open]");
      if (openBox) {
        event.preventDefault();
        openBox.open = false;
        var boxSummary = openBox.querySelector("summary");
        if (boxSummary) boxSummary.focus();
        announce("החלונית נסגרה.");
        return;
      }
    }

    if (!isEditable && hasActiveFilters()) {
      clearAllFilters({ focus: false });
    }
  });

  /* ==========================================================
     סביבת בטא (window.JLM_BETA) — יכולות ניסיוניות עד לאישור פרסום.
     הכל נבנה רק כשהדגל פעיל; באתר הציבורי שום דבר מהאזור הזה אינו קיים.
     ========================================================== */

  function isBeta() {
    return Boolean(window.JLM_BETA);
  }

  /** התאריך המאוחר ביותר שבו סימנו ביקור או השלמה ידנית — "" אם אין */
  function lastActivityISO() {
    var latest = "";
    Object.keys(state.visited).forEach(function (id) {
      var d = state.visited[id] && state.visited[id].date;
      if (d && d > latest) latest = d;
    });
    Object.keys(state.manualCompletions || {}).forEach(function (area) {
      var d = state.manualCompletions[area] && state.manualCompletions[area].completedAt;
      if (d && d > latest) latest = d;
    });
    return latest;
  }

  function parseIso(text) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ""));
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  /* תביעת האחסון הזמני של הדפדפן — אם היא חסומה, התזכורת תוצג בכל כניסה */
  function sessionMemory() {
    try {
      var probe = window.sessionStorage;
      probe.getItem("jlm-beta-probe");
      return probe;
    } catch (error) {
      return null;
    }
  }

  /* ---------- גלריית ההישגים ---------- */

  var galleryBadgesView = true; /* בברירת מחדל בבטא — מוצגת הגלריה */

  function buildAchievementsGallery() {
    if (!el.achievementsDetails) return;
    if (document.getElementById("achievements-view-toggle")) return;

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "achievements-view-toggle";
    toggle.className = "btn btn--quiet btn--small achievements__view-toggle";
    toggle.textContent = "גלריית הישגים";
    toggle.addEventListener("click", function () {
      galleryBadgesView = !galleryBadgesView;
      renderAchievements();
      announce(galleryBadgesView
        ? "מוצגת גלריית ההישגים, עם התקדמות לכל תג."
        : "מוצגת הרשימה המקוצרת של ההישגים.");
    });
    el.achievementsDetails.appendChild(toggle);

    var gallery = document.createElement("div");
    gallery.id = "achievements-gallery";
    gallery.setAttribute("aria-label", "גלריית ההישגים עם התקדמות לכל תג");
    el.achievementsDetails.appendChild(gallery);

    syncGalleryToggle(toggle);

    /* סיבוב החץ כשהחלונית נפתחת/נסגרת — החלפת תו החץ */
    var chevron = el.achievementsDetails.querySelector(".achievements__chevron");
    var summary = el.achievementsDetails.querySelector("summary");
    if (chevron && summary) {
      summary.addEventListener("click", function () {
        var willBeOpen = !el.achievementsDetails.open;
        Promise.resolve().then(function () {
          chevron.textContent = willBeOpen ? "▸" : "▾";
        });
      });
      // מצב התחלתי
      chevron.textContent = el.achievementsDetails.open ? "▸" : "▾";
    }
  }

  function syncedGalleryToggle() {
    return document.getElementById("achievements-view-toggle");
  }

  function syncGalleryToggle(toggle) {
    var button = toggle || syncedGalleryToggle();
    if (!button) return;
    button.setAttribute("aria-pressed", galleryBadgesView ? "true" : "false");
  }

  function renderAchievementsGallery(badges) {
    var gallery = document.getElementById("achievements-gallery");
    if (!gallery) return;
    syncGalleryToggle();
    if (!galleryBadgesView) {
      gallery.hidden = true;
      gallery.innerHTML = "";
      return;
    }
    gallery.hidden = false;

    gallery.innerHTML = ACHIEVEMENT_CATEGORIES.map(function (category) {
      var items = badges.filter(function (badge) { return badge.category === category.id; });
      if (!items.length) return "";
      return (
        '<section class="badge-group" aria-label="' + escapeHtml(category.label) + '">' +
          '<h3 class="badge-group__title">' + escapeHtml(category.label) + "</h3>" +
          '<ul class="badge-group__list">' +
            items.map(function (badge) {
              var progress = badge.progress || null;
              var target = progress ? Math.max(1, Number(progress[1]) || 1) : 0;
              var current = progress ? Number(progress[0]) || 0 : 0;
              var width = badge.unlocked ? 100 : progress ? Math.min(100, (current / target) * 100) : 0;
              var stateText = badge.unlocked
                ? "הושג"
                : progress
                  ? "עוד לא — " + formatNumber(Math.min(current, target)) + " מתוך " + formatNumber(target)
                  : "טרם הושג";
              return (
                '<li class="badge-card' + (badge.unlocked ? " is-unlocked" : "") + '">' +
                  '<span class="badge-card__icon" aria-hidden="true">' + badge.icon + "</span>" +
                  '<span class="badge-card__title">' + escapeHtml(badge.title) + "</span>" +
                  '<span class="badge-card__desc">' + escapeHtml(badge.desc) + "</span>" +
                  '<span class="badge-card__bar" aria-hidden="true"><span style="width:' + width.toFixed(1) + '%"></span></span>' +
                  '<span class="badge-card__state">' + escapeHtml(stateText) + "</span>" +
                "</li>"
              );
            }).join("") +
          "</ul>" +
        "</section>"
      );
    }).join("");
  }

  /* ---------- תצוגת יומן (קריאה של כל הביקורים) ---------- */

  var journalActive = false;

  function buildJournalToggle() {
    if (!el.list || document.getElementById("journal-toggle")) return;
    var controlsHost = document.querySelector(".list-controls");
    if (!controlsHost) return;
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "journal-toggle";
    toggle.className = "btn btn--quiet btn--small";
    toggle.setAttribute("aria-pressed", "false");
    toggle.textContent = "יומן ביקורים";
    toggle.title = "תצוגת קריאה: כל הביקורים לפי תאריך, עם דירוגים והערות";
    toggle.addEventListener("click", toggleJournal);
    controlsHost.appendChild(toggle);
  }

  function toggleJournal() {
    journalActive = !journalActive;
    syncJournalView();
    announce(journalActive
      ? "תצוגת היומן פתוחה — מוצגים " + formatNumber(countVisited()) + " ביקורים, מהחדש לישן."
      : "חזרה לרשימת הרחובות.");
  }

  function syncJournalView() {
    var toggle = document.getElementById("journal-toggle");
    if (!toggle) {
      journalActive = false; /* בטיחות: בלי כפתור — אין מצב יומן */
    } else {
      toggle.setAttribute("aria-pressed", journalActive ? "true" : "false");
    }

    var viewToggleGroup = document.querySelector(".view-toggle");
    var sortField = document.getElementById("area-sort");
    var sortWrap = sortField ? sortField.closest(".field--sort") : null;
    var hint = document.getElementById("list-hint");
    if (viewToggleGroup) viewToggleGroup.hidden = journalActive;
    if (sortWrap) sortWrap.hidden = journalActive;
    if (hint) hint.hidden = journalActive;

    var host = document.getElementById("journal-view");
    if (!journalActive) {
      if (host) { host.hidden = true; host.innerHTML = ""; } /* לא להשאיר תוכן ישן ב-DOM */
      if (el.empty) el.empty.hidden = true;
      if (el.list) el.list.hidden = false;
      renderList(); /* משיב מונים ומצב-ריק לתצוגה הרגילה */
      return;
    }
    if (el.list) el.list.hidden = true;
    renderJournal();
    host = document.getElementById("journal-view");
    if (host) host.hidden = false;
  }

  function repeatText(text, count) {
    var out = "";
    for (var i = 0; i < count; i += 1) out += text;
    return out;
  }

  function localIso(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function journalDateLabel(iso) {
    if (iso === today()) return "היום · " + iso;
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (iso === localIso(yesterday)) return "אתמול · " + iso;
    try {
      var formatter = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });
      var formatted = formatter.format(parseIso(iso));
      return formatted + " · " + iso;
    } catch (error) {
      return iso;
    }
  }

  function renderJournal() {
    var host = document.getElementById("journal-view");
    if (!host) {
      host = document.createElement("div");
      host.id = "journal-view";
      host.className = "journal";
      host.setAttribute("aria-label", "יומן הביקורים — תצוגת קריאה");
      if (el.list && el.list.parentNode) {
        el.list.parentNode.insertBefore(host, el.list);
      } else {
        return;
      }
    }

    var byId = Object.create(null);
    allStreets().forEach(function (street) { byId[street.id] = street; });

    var entries = [];
    Object.keys(state.visited).forEach(function (id) {
      var record = state.visited[id];
      var street = byId[id];
      if (!record || !street) return;
      entries.push({
        date: String(record.date || ""),
        note: String(record.note || "").trim(),
        rating: Number(record.rating || 0),
        mood: String(record.mood || ""),
        name: street.name,
        area: street.area || "אחר"
      });
    });
    entries.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.name.localeCompare(b.name, "he");
    });

    if (!entries.length) {
      host.innerHTML =
        '<p class="journal__empty">עדיין לא ביקרתם באף רחוב. כשתסמנו ביקור ראשון, ' +
        "הוא יופיע כאן לפי תאריך, עם הדירוג וההערה שתכתבו.</p>";
      return;
    }

    var groups = [];
    var currentUserDate = null;
    var currentGroup = null;
    entries.forEach(function (entry) {
      if (entry.date !== currentUserDate) {
        currentUserDate = entry.date;
        currentGroup = { date: entry.date, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(entry);
    });

    host.innerHTML = groups.map(function (group) {
      var items = group.items.map(function (entry) {
        var ratingOn = Math.min(5, Math.max(0, entry.rating));
        var stars = ratingOn > 0
          ? repeatText("★", ratingOn) + repeatText("☆", 5 - ratingOn)
          : "בלי דירוג";
        return (
          '<li class="journal__entry">' +
            '<h3 class="journal__street">' + escapeHtml(entry.name) + "</h3>" +
            '<p class="journal__meta">' +
              escapeHtml(entry.area) +
              "<span class=\"journal__meta-sep\" aria-hidden=\"true\"> · </span>" +
              '<span class="journal__stars" dir="ltr">דירוג: ' + stars + "</span>" +
            "</p>" +
            (entry.note ? '<p class="journal__note">' + escapeHtml(entry.note) + "</p>" : "") +
          "</li>"
        );
      }).join("");
      return (
        '<section class="journal__group" aria-label="' + escapeHtml(journalDateLabel(group.date)) + '">' +
          '<h3 class="journal__date">' + escapeHtml(journalDateLabel(group.date)) + "</h3>" +
          '<ul class="journal__list">' + items + "</ul>" +
        "</section>"
      );
    }).join("");
  }

  /* ---------- שלד טעינה (skeleton) ---------- */

  function renderListSkeleton() {
    if (!el.list) return;
    var rows = [];
    for (var i = 0; i < 6; i += 1) {
      rows.push(
        '<li class="sk-row" aria-hidden="true">' +
          '<span class="sk-row__circle"></span>' +
          '<span class="sk-row__line sk-row__line--wide"></span>' +
          '<span class="sk-row__line sk-row__line--short"></span>' +
          '<span class="sk-row__line sk-row__line--faint"></span>' +
        "</li>"
      );
    }
    el.list.innerHTML = rows.join("");
  }

  /* ---------- תזכורת עדינה — פעם ביום, רק אם עברו שני ימים לפחות ---------- */

  function bootDailyReminder() {
    var memory = sessionMemory();
    var dayKey = "jlm-reminder-" + today();
    if (memory && memory.getItem(dayKey)) return;

    var last = lastActivityISO();
    if (!last) return; /* עוד לא סימנו ביקור — לא מציקים בכניסה ראשונה */

    var from = parseIso(last);
    var to = parseIso(today());
    if (!from || !to) return;
    var gap = Math.round((to - from) / 86400000);
    if (gap < 2) return;

    if (memory) {
      try { memory.setItem(dayKey, "1"); } catch (error) { /* בלי זיכרון — מציגים בכל כניסה */ }
    }
    var gapText = gap === 2 ? "יומיים" : formatNumber(gap) + " ימים";
    window.setTimeout(function () {
      showToast("נעים לראות אתכם שוב! עברו " + gapText + " מאז הסימון האחרון. אפשר להמשיך מכאן.", null);
    }, 800);
  }

  
  /* ---------- לוח היסטוריית ביטול (בטא) ---------- */

  var undoHistoryActive = false;

  function buildUndoHistoryToggle() {
    if (!el.list || document.getElementById("undo-history-toggle")) return;
    var controlsHost = document.querySelector(".list-controls");
    if (!controlsHost) return;
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "undo-history-toggle";
    toggle.className = "btn btn--quiet btn--small";
    toggle.setAttribute("aria-pressed", "false");
    toggle.textContent = "היסטוריית ביטול";
    toggle.title = "מציג את 10 הפעולות האחרונות עם אפשרות ביטול לכל אחת";
    toggle.addEventListener("click", toggleUndoHistory);
    controlsHost.appendChild(toggle);
  }

  function toggleUndoHistory() {
    undoHistoryActive = !undoHistoryActive;
    syncUndoHistoryView();
    announce(undoHistoryActive
      ? "היסטוריית ביטול פתוחה — " + formatNumber(undoStack.length) + " פעולות."
      : "היסטוריית ביטול נסגרה.");
  }

  function syncUndoHistoryView() {
    var toggle = document.getElementById("undo-history-toggle");
    if (!toggle) { undoHistoryActive = false; return; }
    toggle.setAttribute("aria-pressed", undoHistoryActive ? "true" : "false");

    var host = document.getElementById("undo-history-view");
    if (!undoHistoryActive) {
      if (host) { host.hidden = true; host.innerHTML = ""; }
      return;
    }
    if (!host) {
      host = document.createElement("div");
      host.id = "undo-history-view";
      host.className = "undo-history";
      host.setAttribute("aria-label", "היסטוריית פעולות אחרונות");
      if (el.list && el.list.parentNode) {
        el.list.parentNode.insertBefore(host, el.list);
      } else return;
    }
    renderUndoHistory();
    host.hidden = false;
  }

  function formatUndoEntry(entry, index) {
    if (!entry) return "";
    if (entry.batch) {
      return '<li class="undo-history__entry"><span class="undo-history__index">' + (index + 1) + '.</span> <span class="undo-history__text">' + escapeHtml(entry.name) + "</span></li>";
    }
    if (entry.deleteStreet) {
      return '<li class="undo-history__entry"><span class="undo-history__index">' + (index + 1) + '.</span> <span class="undo-history__text">מחיקה: ' + escapeHtml(entry.deleteStreet.name) + "</span></li>";
    }
    if (entry.area && entry.prev !== undefined) {
      return '<li class="undo-history__entry"><span class="undo-history__index">' + (index + 1) + '.</span> <span class="undo-history__text">סיום ידני: ' + escapeHtml(entry.area) + (entry.prev ? " (יש קודם)" : "") + "</span></li>";
    }
    if (entry.id) {
      var action = entry.prev ? "ביטול ביקור" : "סימון ביקור";
      return '<li class="undo-history__entry"><span class="undo-history__index">' + (index + 1) + '.</span> <span class="undo-history__text">' + action + ': ' + escapeHtml(entry.name) + (entry.prev ? ' — היה: ' + escapeHtml(entry.prev.date) + (entry.prev.note ? ', ' + escapeHtml(entry.prev.note) : '') : '') + "</span></li>";
    }
    return '<li class="undo-history__entry"><span class="undo-history__index">' + (index + 1) + '.</span> <span class="undo-history__text">פעולה לא מזוהה</span></li>';
  }

  function renderUndoHistory() {
    var host = document.getElementById("undo-history-view");
    if (!host) return;
    if (!undoStack.length) {
      host.innerHTML = '<p class="undo-history__empty">אין פעולות לביטול.</p>';
      return;
    }
    var items = [];
    for (var i = undoStack.length - 1; i >= 0; i -= 1) {
      items.push(formatUndoEntry(undoStack[i], undoStack.length - 1 - i));
    }
    host.innerHTML = '<ul class="undo-history__list">' + items.join("") + '</ul>';
  }

  /* ---------- אתגר יומי / יעד סטריק (בטא) ---------- */

  var DAILY_GOAL = 3; /* כמה רחובות לשאוף בכל יום */

  function buildDailyGoal() {
    if (document.getElementById("daily-goal")) return;
    var anchor = document.getElementById("breakdown-details");
    if (!anchor) return;
    var badge = document.createElement("div");
    badge.id = "daily-goal";
    badge.className = "daily-goal";
    badge.setAttribute("role", "status");
    badge.setAttribute("aria-live", "polite");
    badge.setAttribute("aria-atomic", "true");
    anchor.parentNode.insertBefore(badge, anchor);
    renderDailyGoal();
  }

  function renderDailyGoal() {
    var badge = document.getElementById("daily-goal");
    if (!badge) return;
    var todayKey = today();
    var countToday = 0;
    Object.keys(state.visited).forEach(function (id) {
      var rec = state.visited[id];
      if (rec && rec.date === todayKey) countToday += 1;
    });
    var streak = streakDays();
    var progress = Math.min(100, Math.round((countToday / DAILY_GOAL) * 100));
    var streakText = streak > 0 ? ' · <span class="daily-goal__streak">🔥 ' + streak + '</span>' : '';
    var status = countToday >= DAILY_GOAL ? 'daily-goal--done' : '';
    badge.innerHTML =
      '<span class="daily-goal__label">יעד יומי</span>' +
      '<span class="daily-goal__progress ' + status + '" style="--pct:' + progress + '%" aria-hidden="true">' +
        '<span class="daily-goal__bar"></span>' +
      '</span>' +
      '<span class="daily-goal__count">' + countToday + '/' + DAILY_GOAL + '</span>' +
      streakText;
    badge.hidden = false;
  }

  /* ---------- אתחול ---------- */
/* ---------- אתחול ---------- */


  el.bannerClose.addEventListener("click", hideBanner);

  window.addEventListener("pagehide", flushPendingNotes);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushPendingNotes();
  });

  // Clear street highlight when clicking anywhere on screen
  document.addEventListener("click", function (event) {
    var highlighted = el.list.querySelector(".street.is-highlighted");
    if (highlighted) {
      var target = event.target;
      // Don't clear if clicking on the highlighted row itself or its buttons
      if (target.closest(".street.is-highlighted") === highlighted) return;
      highlighted.classList.remove("is-highlighted");
    }
  });

  syncStatusButtons();
  syncThemeColor();

  /* משרטטים שלד, ורק אחרי הפריים הראשון רונדרים את הרשימה המלאה (בלי לחסום את הציור) */
  if (el.list) {
    buildAchievementsGallery();
    buildJournalToggle();
    buildUndoHistoryToggle();
    buildDailyGoal();
    renderListSkeleton();
    var bootRenderDone = false;
    function bootRender() {
      if (bootRenderDone) return;
      bootRenderDone = true;
      render();
      if (el.loading) el.loading.hidden = true;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(bootRender);
    });
    /* גיבוי: בלשונית שאינה נראית requestAnimationFrame מושהה — הרנדר יחול גם בטיימאוט */
    window.setTimeout(bootRender, 120);
    bootDailyReminder();
  } else {
    render();

    if (el.loading) el.loading.hidden = true;
  }

  if (storageStatus === "corrupt") {
    var backupKey = Store.backup(loaded.raw);
    showBanner(
      "הנתונים השמורים בדפדפן לא היו קריאים, ולכן לא נטענו. " +
        (backupKey ? "עותק של הנתונים הפגומים נשמר תחת המפתח " + backupKey + ". " : "") +
        "שינוי חדש שייעשה כאן יישמר תחת המפתח הרגיל."
    );
  } else if (storageStatus === "unavailable") {
    showBanner("אין גישה לאחסון המקומי בדפדפן הזה. הביקורים לא יישמרו בין רענונים.");
  } else if (storageStatus === "empty" && !Store.save(state)) {
    showBanner("שמירה נשפלה — ייתכן שהאחסון בדפדפן חסום או מלא. הביקורים לא יישמרו.");
  }
})();
