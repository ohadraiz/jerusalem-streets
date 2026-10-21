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
  var SEARCH_DEBOUNCE = 150;
  var UNDO_LIMIT = 10;
  var TOAST_TIMEOUT = 9000;
  var PAGE_SIZE = 200;
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

  /* מצב האקורדיון והתצוגה — בזיכרון בלבד */
  var openAreas = new Set();
  var areaLimit = AREA_PAGE_SIZE;
  var sortMode = "remaining";
  var listView = "areas"; // "areas" | "all"
  var flatListPage = 1; // for paginated flat list

  /* שכונות שכבר חוגגו כ"הושלמה" בסשן הנוכחי — מונע חגיגה כפולה */
  var celebratedAreas = new Set();

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
    quickAreas: document.getElementById("quick-areas"),
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

  /** רחובות לתצוגה השטוחה — מסודרים א׳–ת, בלי לשנות את סדר הנתונים */
  function flatStreets() {
    return visibleStreets().slice().sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""), "he");
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
      '<li class="street' + (visited ? " is-visited" : "") + '" data-id="' + escapeHtml(street.id) + '">' +
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
              "</div>"
            : "") +
        "</div>" +
      "</li>"
    );
  }

  /** שם נגיש לכותרת שכונה — כולל המונים, כדי שקורא מסך ידע מה נשאר */
  function areaLabel(area, visited, total, left) {
    return (
      area + " — " + visited + " מתוך " + total + " רחובות סומנו, " +
      (left > 0 ? left + " נשארו" : "השכונה הושלמה")
    );
  }

  /** כותרת שכונה + הפאנל שלה (רק אם פתוחה) */
  function areaMarkup(area, position) {
    var open = openAreas.has(area.area);
    var panelId = "area-panel-" + position;
    var done = area.total > 0 && area.visited >= area.total;
    var percent = percentValue(area.visited, area.total);
    var left = area.total - area.visited;

    return (
      '<li class="area-group' + (done ? " is-done" : "") + '" data-group="' + escapeHtml(area.area) + '">' +
        '<div class="area-group__head">' +
          '<button type="button" class="area-group__name" data-action="area-focus" data-area="' + escapeHtml(area.area) + '"' +
            ' aria-expanded="' + (open ? "true" : "false") + '" aria-controls="' + panelId + '"' +
            ' aria-label="' + escapeHtml(areaLabel(area.area, area.visited, area.total, left)) + '"' +
            ' title="פותח את הרחובות של השכונה וממקד את המפה בה">' +
            escapeHtml(area.area) +
          "</button>" +
          '<span class="area-group__count" dir="ltr">' + area.visited + "/" + area.total + "</span>" +
          '<span class="area-group__pct">' + percentText(area.visited, area.total) + "</span>" +
          '<span class="area-group__bar" aria-hidden="true"><span style="width:' + percent.toFixed(2) + '%"></span></span>' +
          '<span class="area-group__badge"' + (done ? "" : " hidden") + ">הושלמה</span>" +
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

  /** תצוגה שטוחה — בשימוש חיפוש פעיל */
  function renderFlatList(streets) {
    var total = streets.length;
    var totalPages = Math.ceil(total / PAGE_SIZE);
    if (flatListPage > totalPages) flatListPage = 1;
    if (flatListPage < 1) flatListPage = 1;

    var start = (flatListPage - 1) * PAGE_SIZE;
    var slice = streets.slice(start, start + PAGE_SIZE);

    var pagination = "";
    if (totalPages > 1) {
      var prevBtn = flatListPage > 1
        ? '<button type="button" class="pagination__btn" data-action="flat-prev" aria-label="עמוד קודם">‹ קודם</button>'
        : '<span class="pagination__btn pagination__btn--disabled" aria-hidden="true">‹ קודם</span>';
      var nextBtn = flatListPage < totalPages
        ? '<button type="button" class="pagination__btn" data-action="flat-next" aria-label="עמוד הבא">הבא ›</button>'
        : '<span class="pagination__btn pagination__btn--disabled" aria-hidden="true">הבא ›</span>';
      var pageInfo = '<span class="pagination__info" aria-live="polite">עמוד ' + flatListPage + ' מתוך ' + totalPages + '</span>';
      pagination = '<div class="pagination" role="navigation" aria-label="דפדוף תוצאות">' + prevBtn + pageInfo + nextBtn + '</div>';
    }

    el.list.innerHTML = pagination + slice.map(streetRow).join("") + pagination;

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
      el.statsSummary.textContent =
        formatNumber(rows.length) + " שכונות ברשימה · " + formatNumber(total) + " רחובות";
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

    renderQuickAreas(rows, visited);
    renderAreaOptions();
  }

  /**
   * שורת קיצורים: בכניסה ראשונה — השכונות הגדולות ביותר (נקודת התחלה);
   * אחרי שמתחילים לסמן — השכונות שבהן הכי התקדמנו.
   */
  function renderQuickAreas(rows, visited) {
    if (!el.quickAreas) return;

    var title;
    var items;

    if (visited === 0) {
      title = "מתחילים כאן — השכונות הגדולות ביותר";
      items = rows
        .slice()
        .sort(function (a, b) {
          if (b.total !== a.total) return b.total - a.total;
          return a.area.localeCompare(b.area, "he");
        })
        .slice(0, 6);
    } else {
      title = "התקדמות לפי שכונה";
      items = rows.slice(0, 6);
    }

    el.quickAreas.innerHTML =
      '<p class="quick__title">' + title + "</p>" +
      '<ul class="quick__list">' +
      items
        .map(function (row) {
          var count = visited === 0 ? formatNumber(row.total) + " רחובות" : row.visited + "/" + row.total;
          return (
            '<li class="quick__item">' +
              '<button type="button" class="chip" data-area="' + escapeHtml(row.area) + '">' +
                '<span class="chip__name">' + escapeHtml(row.area) + "</span>" +
                '<span class="chip__count">' + count + "</span>" +
              "</button>" +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
  }

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
      title.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }

  function scrollToMap() {
    var section = el.mapSection;
    if (section && typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ block: "start", behavior: "smooth" });
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
    
    // Scroll map into view so user sees the focused area
    var mapEl = document.getElementById("map");
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    
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
    var batch = [];
    pending.forEach(function (street) {
      batch.push({ id: street.id, prev: null });
      state.visited[street.id] = { date: today(), note: "" };
    });

    pushUndo({ batch: batch, name: "סימון " + formatNumber(pending.length) + " רחובות בשכונה " + area });
    persist();

    var after = areaStats(area);
    var completion = completionMessage(area, before, after);
    var text = completion ? completion.text : ("סומנו " + formatNumber(pending.length) + " רחובות בשכונה " + area);

    showToast(text, "בטל");
    announce(
      text + ". ביקרתם " + formatNumber(countVisited()) + " מתוך " + formatNumber(allStreets().length) + "."
    );

    renderList();
    renderStats();
    updateAreaUI(area);
    focusAreaControl(area, "batch-mark");

    batch.forEach(function (item) {
      emitVisitedChange(item.id);
    });
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
      batch.push({ id: street.id, prev: { date: record.date, note: record.note } });
      delete state.visited[street.id];
    });

    pushUndo({ batch: batch, name: "ביטול הסימון של " + formatNumber(marked.length) + " רחובות בשכונה " + area });
    persist();

    var after = areaStats(area);
    var completion = completionMessage(area, before, after);
    var text = completion ? completion.text : ("בוטל הסימון של " + formatNumber(marked.length) + " רחובות בשכונה " + area);

    showToast(text, "בטל");
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

    var count = group.querySelector(".area-group__count");
    if (count) count.textContent = stats.visited + "/" + stats.total;

    var nameButton = group.querySelector(".area-group__name");
    if (nameButton) {
      nameButton.setAttribute(
        "aria-label",
        areaLabel(area, stats.visited, stats.total, stats.total - stats.visited)
      );
    }

    var pct = group.querySelector(".area-group__pct");
    if (pct) pct.textContent = percentText(stats.visited, stats.total);

    var bar = group.querySelector(".area-group__bar > span");
    if (bar) bar.style.width = percent.toFixed(2) + "%";

    var badge = group.querySelector(".area-group__badge");
    if (badge) badge.hidden = !done;

    if (done) group.classList.add("is-done");
    else group.classList.remove("is-done");

    var card = group.querySelector(".area-card");
    if (!card) return;

    var title = card.querySelector(".area-card__title");
    if (title) {
      title.textContent =
        "שכונת " + area + ": " + stats.visited + " מתוך " + stats.total + " רחובות סומנו — " +
        percentText(stats.visited, stats.total);
    }

    var cardBar = card.querySelector(".area-card__bar > span");
    if (cardBar) cardBar.style.width = percent.toFixed(2) + "%";

    var actions = card.querySelector(".area-card__actions");
    if (!actions) return;

    var mark = actions.querySelector('[data-action="batch-mark"]');
    if (mark) mark.hidden = stats.visited >= stats.total;

    var unmark = actions.querySelector('[data-action="batch-unmark"]');
    if (unmark) unmark.hidden = stats.visited === 0;
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
      row.scrollIntoView({ block: "center", behavior: "smooth" });
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

    /* עותק לפני השינוי — מאפשר לבטל את הפעולה ולהחזיר תאריך והערה */
    var wasVisited = isVisited(id);
    var prev = wasVisited
      ? { date: state.visited[id].date, note: state.visited[id].note }
      : null;

    var message;
    if (wasVisited) {
      delete state.visited[id];
      message = "הביקור ב" + street.name + " בוטל";
    } else {
      state.visited[id] = { date: today(), note: "" };
      message = "סומן ביקור ב" + street.name;
    }

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
        ". ביקרתם " + formatNumber(countVisited()) + " מתוך " + formatNumber(allStreets().length) +
        ". אפשר לבטל את הפעולה."
    );
    showToast(text, "בטל");

    /* עדכון השורה והמונים — בלי לרנדר את כל הרשימה ובלי לקפל את השכונה */
    if (filters.status === "all") {
      if (findRow(id)) refreshRow(id);
    } else {
      renderList();
    }
    updateAreaUI(area);
    renderStats();
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
    showToast(text, "בטל");
    announce(text + ". אפשר לבטל את הפעולה.");
    return true;
  }

  /* ---------- ביטול פעולה (בזיכרון בלבד) ---------- */

  function showToast(message, undoLabel) {
    if (!el.toast) return;
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
    if (el.toast) el.toast.hidden = true;
  }

  /** מחזיר את הרחובים למצבם לפני הפעולה האחרונה — כולל תאריך והערה */
  function undoLastAction() {
    var entry = undoStack.pop();
    if (!entry) return;

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
          state.visited[item.id] = { date: item.prev.date, note: item.prev.note };
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
      state.visited[entry.id] = { date: entry.prev.date, note: entry.prev.note };
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

  bindAreaButtons(el.quickAreas);
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

  /* ---------- קיצורי מקלדת ---------- */

  document.addEventListener("keydown", function (event) {
    if (event.defaultPrevented) return;

    var target = event.target;
    var tag = target && target.tagName ? target.tagName.toLowerCase() : "";
    var isEditable =
      tag === "input" || tag === "textarea" || tag === "select" || (target && target.isContentEditable);

    /* "/" מביא את המיקוד לחיפוש — אך לא בתוך שדה טקסט */
    if (event.key === "/" && !isEditable && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      el.search.focus();
      el.search.select();
      return;
    }

    if (event.key !== "Escape") return;

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

    if (!isEditable && hasActiveFilters()) {
      clearAllFilters({ focus: false });
    }
  });

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
  render();

  if (el.loading) el.loading.hidden = true;

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
