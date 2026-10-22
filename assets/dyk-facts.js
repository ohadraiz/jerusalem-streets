/**
 * dyk-facts.js — "הידעת?" — מערכת העובדות עבור רחובות ירושלים.
 *
 * סקריפט קלאסי (ללא ESM) — האפליקציה טוענת את assets/*.js כסקריפטים קלאסיים.
 * חושף: window.JLMFacts
 *
 * מקורות: data/didyouknow/index.json (רשימת המזהים שיש להם עובדה)
 *         data/didyouknow/<street-id>.txt (העובדה + מקורות + מטא)
 *
 * שני מקומות תצוגה:
 *  1. חלון צף (Modal) — נפתח מכפתור "הידעת?" ברשימת הרחובות או בחלון הרחוב במפה.
 *  2. כפתור "הידעת?" מוזרק לכל שורת רחוב שיש לה עובדה (MutationObserver).
 *
 * נגישות: role="dialog", aria-modal, focus trap, Esc לסגירה, שחזור פוקוס,
 *          aria-live להכרזת פתיחה, dir="rtl".
 */
(function () {
  "use strict";

  var INDEX_URL = "data/didyouknow/index.json";
  var FACT_DIR = "data/didyouknow/";

  var factCache = Object.create(null); /* street_id → fact או null */
  var pending = Object.create(null); /* street_id → Promise */
  var indexIds = null; /* Object.create(null) */
  var indexPromise = null;

  var dialog = null;
  var dialogBody = null;
  var dialogTitle = null;
  var lastTrigger = null;
  var keyHandler = null;

  /* ------------------------------------------------------------------ */
  /* אינדקס                                                             */
  /* ------------------------------------------------------------------ */

  function loadIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = fetch(INDEX_URL)
      .then(function (resp) {
        return resp.ok ? resp.json() : { ids: [] };
      })
      .then(function (data) {
        indexIds = Object.create(null);
        var ids = (data && data.ids) || [];
        for (var i = 0; i < ids.length; i++) indexIds[ids[i]] = true;
        return indexIds;
      })
      .catch(function () {
        indexIds = Object.create(null);
        return indexIds;
      });
    return indexPromise;
  }

  /**
   * האם לרחוב הזה יש עובדה? לפני שהאינדקס נטען — false, והסריקה תחזור אחרי.
   */
  function has(streetId) {
    if (!streetId) return false;
    if (!indexIds) {
      loadIndex();
      return false;
    }
    return indexIds[streetId] === true;
  }

  /* ------------------------------------------------------------------ */
  /* טעינת קובץ עובדה                                                    */
  /* ------------------------------------------------------------------ */

  function parseFact(text) {
    var obj = { source: [] };
    var lines = String(text).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var m = /^([a-z_]+):\s?(.*)$/.exec(lines[i]);
      if (!m) continue;
      if (m[1] === "source") obj.source.push(m[2]);
      else obj[m[1]] = m[2];
    }
    if (!obj.street_id || !obj.fact) return null;
    return obj;
  }

  function get(streetId) {
    if (!streetId) return Promise.resolve(null);
    if (factCache[streetId]) return Promise.resolve(factCache[streetId]);
    if (pending[streetId]) return pending[streetId];

    pending[streetId] = fetch(FACT_DIR + encodeURIComponent(streetId) + ".txt")
      .then(function (resp) {
        if (!resp.ok) return null;
        return resp.text();
      })
      .then(function (text) {
        var fact = text ? parseFact(text) : null;
        factCache[streetId] = fact;
        delete pending[streetId];
        return fact;
      })
      .catch(function () {
        delete pending[streetId];
        return null;
      });

    return pending[streetId];
  }

  /* ------------------------------------------------------------------ */
  /* בניית תוכן החלון                                                     */
  /* ------------------------------------------------------------------ */

  function friendlySourceName(url) {
    try {
      var host = new URL(url, window.location.href).host.replace(/^www\./, "");
      if (host.indexOf("he.wikipedia.org") === 0) return "ויקיפדיה העברית";
      if (host.indexOf("wikipedia.org") === 0) return "ויקיפדיה";
      if (host.indexOf("jerusalem.muni.il") === 0) return "עיריית ירושלים — שמות רחובות";
      if (host.indexOf("hamichlol.org.il") === 0) return "המכלול";
      if (host.indexOf("data.gov.il") === 0) return "data.gov.il";
      if (host.indexOf("openstreetmap.org") === 0) return "OpenStreetMap";
      return host;
    } catch (e) {
      return url;
    }
  }

  function buildFactContent(fact) {
    var frag = document.createDocumentFragment();

    var text = document.createElement("p");
    text.className = "dyk-modal__fact";
    text.textContent = fact.fact;
    text.setAttribute("tabindex", "-1");
    frag.appendChild(text);

    /* קישור לרחוב — מעביר למפה ומדגיש את הרחוב ברשימה */
    var actions = document.createElement("div");
    actions.className = "dyk-modal__actions";

    var toMap = document.createElement("button");
    toMap.type = "button";
    toMap.className = "dyk-modal__action";
    toMap.textContent = "הצג במפה";
    toMap.setAttribute("aria-label", "הצג את הרחוב " + fact.street_name + " במפה");
    toMap.addEventListener("click", function () {
      close();
      if (window.JLMAPI && typeof window.JLMAPI.focusStreet === "function") {
        window.JLMAPI.focusStreet(fact.street_id);
      } else if (window.JLMMap && typeof window.JLMMap.zoomToStreet === "function") {
        window.JLMMap.zoomToStreet(fact.street_id, 16);
      }
    });
    actions.appendChild(toMap);

    var toList = document.createElement("button");
    toList.type = "button";
    toList.className = "dyk-modal__action";
    toList.textContent = "מצא ברשימה";
    toList.setAttribute("aria-label", "מצא את הרחוב " + fact.street_name + " ברשימת הרחובות");
    toList.addEventListener("click", function () {
      close();
      if (window.JLMAPI && typeof window.JLMAPI.focusStreet === "function") {
        window.JLMAPI.focusStreet(fact.street_id);
      }
    });
    actions.appendChild(toList);

    frag.appendChild(actions);

    if (fact.source && fact.source.length) {
      var srcBox = document.createElement("div");
      srcBox.className = "dyk-modal__sources";

      var srcTitle = document.createElement("h3");
      srcTitle.className = "dyk-modal__subtitle";
      srcTitle.textContent = "מקורות";
      srcBox.appendChild(srcTitle);

      var ul = document.createElement("ul");
      ul.className = "dyk-modal__source-list";
      for (var i = 0; i < fact.source.length; i++) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = fact.source[i];
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = friendlySourceName(fact.source[i]);
        li.appendChild(a);
        ul.appendChild(li);
      }
      srcBox.appendChild(ul);
      frag.appendChild(srcBox);
    }

    var meta = [];
    if (fact.date_researched) meta.push("תאריך מחקר: " + fact.date_researched);
    if (fact.researcher) meta.push("חוקר: " + fact.researcher);
    if (fact.method) meta.push("שיטה: " + fact.method);

    if (meta.length) {
      var metaBox = document.createElement("p");
      metaBox.className = "dyk-modal__meta";
      metaBox.textContent = meta.join(" · ");
      frag.appendChild(metaBox);
    }

    if (fact.confidence && fact.confidence !== "high") {
      var note = document.createElement("p");
      note.className = "dyk-modal__note";
      note.textContent =
        fact.confidence === "medium"
          ? "העובדה מבוססת על מקור תוכן, אך הקשר המפורש בין שם הרחוב לאדיות שהוא מנציח אינו מופיע במקור."
          : "רמת ביטחון: " + fact.confidence;
      frag.appendChild(note);
    }

    return frag;
  }

  /* ------------------------------------------------------------------ */
  /* חלון צף (Modal)                                                     */
  /* ------------------------------------------------------------------ */

  function buildDialog() {
    if (dialog) return dialog;

    dialog = document.createElement("div");
    dialog.className = "dyk-modal";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "dyk-modal-title");
    dialog.dir = "rtl";
    dialog.hidden = true;

    var backdrop = document.createElement("div");
    backdrop.className = "dyk-modal__backdrop";

    var panel = document.createElement("div");
    panel.className = "dyk-modal__panel";

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "dyk-modal__close";
    closeBtn.setAttribute("aria-label", "סגירת החלון");
    closeBtn.innerHTML = "&times;";

    var head = document.createElement("div");
    head.className = "dyk-modal__head";

    dialogTitle = document.createElement("h2");
    dialogTitle.className = "dyk-modal__title";
    dialogTitle.id = "dyk-modal-title";

    head.appendChild(dialogTitle);
    head.appendChild(closeBtn);

    dialogBody = document.createElement("div");
    dialogBody.className = "dyk-modal__body";

    panel.appendChild(head);
    panel.appendChild(dialogBody);
    dialog.appendChild(backdrop);
    dialog.appendChild(panel);

    backdrop.addEventListener("click", close);
    closeBtn.addEventListener("click", close);

    document.body.appendChild(dialog);
    return dialog;
  }

  function focusables() {
    if (!dialog) return [];
    return Array.prototype.slice.call(
      dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    );
  }

  function trapFocus(event) {
    var items = focusables();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function announce(text) {
    var live = document.getElementById("live");
    if (live) live.textContent = text;
  }

  function open(streetId, trigger) {
    buildDialog();
    lastTrigger = trigger || document.activeElement;

    dialogTitle.textContent = "הידעת?";
    dialogBody.textContent = "טוענים…";
    dialog.hidden = false;
    document.body.classList.add("dyk-modal-open");

    var closeBtn = dialog.querySelector(".dyk-modal__close");
    if (closeBtn) closeBtn.focus();

    get(streetId).then(function (fact) {
      if (!fact) {
        dialogTitle.textContent = "הידעת?";
        dialogBody.textContent = "לא נמצאה עובדה מאומתת לרחוב הזה.";
        announce("לא נמצאה עובדה לרחוב הזה");
        return;
      }
      dialogTitle.textContent = fact.street_name + " — הידעת?";
      dialogBody.textContent = "";
      dialogBody.appendChild(buildFactContent(fact));
      var first = dialogBody.querySelector(".dyk-modal__fact");
      if (first) first.focus();
      announce("נפתח חלון הידעת. " + fact.fact);
    });

    if (!keyHandler) {
      keyHandler = function (event) {
        if (!dialog || dialog.hidden) return;
        if (event.key === "Escape") {
          /* החלון הפתוח הוא בעל ה-Escape — עוצרים את ניקוי החיפוש של האפליקציה */
          event.preventDefault();
          event.stopPropagation();
          close();
          return;
        }
        if (event.key === "Tab") {
          event.stopPropagation();
          trapFocus(event);
        }
      };
      document.addEventListener("keydown", keyHandler, true);
    }
  }

  function close() {
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    dialogBody.textContent = "";
    document.body.classList.remove("dyk-modal-open");
    if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus();
    lastTrigger = null;
  }

  /* ------------------------------------------------------------------ */
  /* כפתור "הידעת?" ברשימת הרחובות                                      */
  /* ------------------------------------------------------------------ */

  function injectButton(row) {
    if (!row || row.getAttribute("data-dyk") === "1") return;

    var streetId = row.getAttribute("data-id");
    if (!streetId || !has(streetId)) return;

    row.setAttribute("data-dyk", "1");

    var head = row.querySelector(".street__head");
    if (!head || head.querySelector(".street__dyk")) return;

    var streetName = row.getAttribute("data-street-name") || "הרחוב";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "street__dyk";
    btn.setAttribute("data-action", "didyouknow");
    btn.setAttribute("aria-label", "תגלית על רחוב " + streetName);
    btn.setAttribute("aria-haspopup", "dialog");
    btn.textContent = "הידעת?";
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      open(streetId, btn);
    });

    /* מכניסים מיד אחרי שם הרחוב — ב-RTL זה נראה מימין לשמאל */
    var nameBtn = head.querySelector(".street__name");
    if (nameBtn && nameBtn.nextSibling) head.insertBefore(btn, nameBtn.nextSibling);
    else head.appendChild(btn);
  }

  function scanList(list) {
    if (!list) return;
    var rows = list.querySelectorAll(".street[data-id]");
    for (var i = 0; i < rows.length; i++) injectButton(rows[i]);
  }

  function startObserver() {
    var list = document.getElementById("street-list");
    if (!list) return;

    scanList(list);

    if (typeof MutationObserver === "function") {
      var observer = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var added = records[i].addedNodes;
          if (!added || !added.length) continue;
          for (var j = 0; j < added.length; j++) {
            var node = added[j];
            if (!node || node.nodeType !== 1) continue;
            if (node.classList && node.classList.contains("street")) injectButton(node);
            var nested = node.querySelectorAll ? node.querySelectorAll(".street[data-id]") : [];
            for (var k = 0; k < nested.length; k++) injectButton(nested[k]);
          }
        }
      });
      observer.observe(list, { childList: true, subtree: true });
    }
  }

  /* ------------------------------------------------------------------ */
  /* חשיפה לחוץ                                                         */
  /* ------------------------------------------------------------------ */

  window.JLMFacts = {
    has: has,
    get: get,
    open: open,
    close: close,
    loadIndex: loadIndex,
    startObserver: startObserver
  };

  /* האתחול — אחרי שה-DOM מוכן */
  function boot() {
    /* סריקה ראשונה: האינדקס עדיין לא נטען, has() מחזיר false — הכפתורים יוזרקו בסריקה הבאה */
    startObserver();

    loadIndex().then(function () {
      var list = document.getElementById("street-list");
      scanList(list);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
