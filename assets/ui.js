/**
 * שכבת ממשק (טוענת אחרי app.js ו-map.js).
 * בקרת הפריסה במסך מלא: סרגל הגישה (#rail) ופאנל המידע (#info-drawer).
 *
 * אחריות: מצבי פתיחה/סגירה, aria-expanded, ניקוד פוקוס (Escape, מעב לחזרה),
 * מעקה פוקוס בפאנל המידע (dialog), ופתיחה אוטומטית כשמיקוד נכנס לפאנל סגור.
 *
 * לא נוגע בנתונים, באחסון, ב-JLMAPI/JLMBus/JLM_GEO ולא בגיאומטריה של המפה.
 * המפה מתעדכנת בעצמה באמצעות ResizeObserver שכבר קיים ב-assets/map.js.
 */
(function () {
  "use strict";

  var rail = document.getElementById("rail");
  var infoDrawer = document.getElementById("info-drawer");
  var scrim = document.getElementById("scrim");
  var listToggle = document.getElementById("list-toggle");
  var infoToggle = document.getElementById("info-toggle");
  var railClose = document.getElementById("rail-close");
  var infoClose = document.getElementById("info-close");

  if (!rail || !infoDrawer || !scrim || !listToggle || !infoToggle) return;

  var mobileQuery = window.matchMedia
    ? window.matchMedia("(max-width: 900px)")
    : null;

  function isMobile() {
    return !!(mobileQuery && mobileQuery.matches);
  }

  /* ---------- סנכרון מצב ---------- */

  function syncToggle(btn, open) {
    if (!btn) return;
    if (btn.getAttribute("aria-expanded") !== String(open)) {
      btn.setAttribute("aria-expanded", String(open));
    }
    if (btn === listToggle) syncFilterToggle();
  }

  function syncFilterToggle() {
    var button = document.getElementById("filter-toggle");
    var tab = document.getElementById("tab-filters");
    if (button && tab) button.setAttribute("aria-expanded", String(railIsOpen() && tab.getAttribute("aria-selected") === "true"));
  }

  function railIsOpen() {
    return !rail.classList.contains("is-closed");
  }

  function drawerIsOpen() {
    return !infoDrawer.hidden && !infoDrawer.classList.contains("is-closed");
  }

  function syncScrim() {
    /* רק פאנל המידע הוא דיאלוג החוסם את הרקע. */
    var needed = drawerIsOpen();
    if (needed) {
      scrim.removeAttribute("hidden");
    } else {
      scrim.setAttribute("hidden", "");
    }
  }

  /* ---------- פאנל מידע (דיאלוג) ---------- */

  var infoOpener = null;

  function focusableList(container) {
    var selector =
      "a[href], button:not([disabled]), input:not([type='hidden']), " +
      "select, textarea, summary, [tabindex]:not([tabindex='-1'])";
    var nodes = container.querySelectorAll(selector);
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node.disabled && node.offsetParent !== null) out.push(node);
    }
    return out;
  }

  function trapFocusInDrawer(event) {
    if (!drawerIsOpen()) return;
    if (event.key !== "Tab") return;
    var focusables = focusableList(infoDrawer);
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || !infoDrawer.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* פוקוס ישיר אחרי אילוץ חישוב סגנונות — בלי rAF (לא רץ בטאבים לא פעילים) */
  function flushStyles(el) {
    if (typeof window.getComputedStyle === "function") window.getComputedStyle(el).visibility;
  }

  function openDrawer(opener) {
    infoOpener = opener || null;
    infoDrawer.removeAttribute("hidden");
    infoDrawer.classList.remove("is-closed");
    infoToggle.setAttribute("aria-expanded", "true");
    if (isMobile() && railIsOpen()) closeRail();
    flushStyles(infoDrawer);
    if (infoClose) infoClose.focus();
    syncScrim();
  }

  function closeDrawer(restoreFocus) {
    if (!drawerIsOpen()) return;
    infoDrawer.classList.add("is-closed");
    infoToggle.setAttribute("aria-expanded", "false");
    var done = false;
    var finish = function () {
      if (done) return;
      done = true;
      infoDrawer.setAttribute("hidden", "");
      syncScrim();
      if (restoreFocus && infoOpener) {
        infoOpener.focus();
      }
      infoOpener = null;
    };
    var supportsTransition = typeof window.getComputedStyle === "function";
    var duration = supportsTransition
      ? parseFloat(window.getComputedStyle(infoDrawer).transitionDuration.split(",")[0]) || 0
      : 0;
    if (duration > 0) {
      window.setTimeout(finish, duration * 1000 + 40);
    } else {
      finish();
    }
  }

  /* ---------- סרגל גישה (רשימת רחובות) ---------- */

  function openRail() {
    rail.classList.remove("is-closed");
    syncToggle(listToggle, true);
    if (isMobile() && drawerIsOpen()) closeDrawer(false);
    /* פתיחה מחדש אינה נופלת ישר למצב המקופל — לתוכן הרשימה פותחים חצי */
    if (sheetStateOf(rail, SHEET_RAIL_STATES) === "collapsed") {
      setSheetState(rail, "rail", "half");
    }
    syncScrim();
  }

  function closeRail() {
    rail.classList.add("is-closed");
    syncToggle(listToggle, false);
    syncScrim();
  }

  function toggleRail() {
    if (railIsOpen()) closeRail();
    else openRail();
  }

  function toggleDrawer() {
    if (drawerIsOpen()) closeDrawer(true);
    else openDrawer(infoToggle);
  }

  /* ---------- גיליון תחתון במובייל: מצבים מקופל/חצי/רחב, ידית משיכה וסיכום ----------
     עיקרון: כל מצב מושג גם בהקשה על הידית (כפתור אמיתי) וגם בגרירה מתונה —
     אף אינטראקציה אינה חייבת הבנת תנועות החלקה. הידית היא יעד מגע בגובה 44px. */

  var SHEET_RAIL_STATES = ["collapsed", "half", "expanded"];
  var SHEET_DRAWER_STATES = ["half", "expanded"];
  var SHEET_LABELS = {
    rail: {
      collapsed: "הצגת סרגל הרשימה",
      half: "הרחבת סרגל הרשימה",
      expanded: "כיווץ סרגל הרשימה"
    },
    drawer: {
      half: "הרחבת פאנל המידע",
      expanded: "כיווץ פאנל המידע"
    }
  };
  var railHandle = null;
  var drawerHandle = null;
  var railPeek = null;
  /* אחרי סיום גרירה ה-click שהדפדפן משגר אמור להתעלם — שומרים מועד סיום ולא טיימר:
     טיימר מגרירה קודמת עלול להתרוקן בדיוק בין גרירה חדשה ל-click שלה. */
  var suppressHandleClickUntil = 0;
  var SUPPRESS_CLICK_WINDOW_MS = 350;

  function sheetStateOf(panel, states) {
    var value = panel.dataset.sheet;
    return states.indexOf(value) !== -1 ? value : "half";
  }

  function sheetStatesFor(kind) {
    return kind === "drawer" ? SHEET_DRAWER_STATES : SHEET_RAIL_STATES;
  }

  function syncHandleLabel(handle, kind, state) {
    if (handle) handle.setAttribute("aria-label", SHEET_LABELS[kind][state]);
  }

  function setSheetState(panel, kind, state) {
    var states = sheetStatesFor(kind);
    if (states.indexOf(state) === -1) return;
    var restoreToExpand = kind === "rail" && state === "collapsed" && panel.contains(document.activeElement);
    panel.style.height = "";
    panel.dataset.sheet = state;
    if (restoreToExpand) {
      var expand = panel.querySelector('.sheet-expand');
      if (expand) expand.focus();
    }
    if (kind === "rail") {
      Array.prototype.forEach.call(rail.querySelectorAll(".sheet-states [data-sheet-target]"), function (button) {
        button.setAttribute("aria-pressed", String(button.dataset.sheetTarget === state));
      });
    }
    syncHandleLabel(kind === "drawer" ? drawerHandle : railHandle, kind, state);
    syncScrim();
  }

  function cycleSheet(panel, kind) {
    var states = sheetStatesFor(kind);
    var index = states.indexOf(sheetStateOf(panel, states));
    if (index === -1) index = states.indexOf("half");
    setSheetState(panel, kind, states[(index + 1) % states.length]);
  }

  function handleCycleClick(kind) {
    return function () {
      /* אחרי גרירה הדפדפן עשוי לשגר click — לא מתייחסים אליו כפעולת מעבר */
      if (Date.now() < suppressHandleClickUntil) return;
      cycleSheet(kind === "drawer" ? infoDrawer : rail, kind);
    };
  }

  function attachSheetDrag(panel, kind, handle, onLowest) {
    var states = sheetStatesFor(kind);
    var active = false;
    var startY = 0;
    var startH = 0;
    var moved = 0;

    var stopDrag = function () {
      active = false;
      panel.classList.remove("is-dragging");
    };

    handle.addEventListener("pointerdown", function (event) {
      if (!event.isPrimary || !isMobile()) return;
      active = true;
      moved = 0;
      /* מחווה חדשה מתחילה: התעלמות ה-click של גרירה קודמת מבוטלת */
      suppressHandleClickUntil = 0;
      startY = event.clientY;
      startH = panel.getBoundingClientRect().height;
      if (typeof handle.setPointerCapture === "function") {
        try { handle.setPointerCapture(event.pointerId); } catch (e) { /* הגרירה תמשיך */ }
      }
    });

    handle.addEventListener("pointermove", function (event) {
      if (!active || !isMobile()) return;
      moved = Math.max(moved, Math.abs(event.clientY - startY));
      if (moved <= 8) return;
      panel.classList.add("is-dragging");
      var viewportH =
        window.innerHeight || document.documentElement.clientHeight || 640;
      var nextHeight = startH + (startY - event.clientY);
      nextHeight = Math.max(40, Math.min(nextHeight, viewportH * 0.94));
      panel.style.height = Math.round(nextHeight) + "px";
    });

    handle.addEventListener("pointerup", function (event) {
      if (!active) return;
      stopDrag();
      if (moved <= 8) return; /* הקשה רגילה — ה-click מטפל במעבר המצב */
      /* סיום גרירה: click עוקב נחסם עד תחילת מחווה חדשה או פקיעת החלון */
      suppressHandleClickUntil = Date.now() + SUPPRESS_CLICK_WINDOW_MS;
      var delta = startY - event.clientY;
      var index = states.indexOf(sheetStateOf(panel, states));
      if (index === -1) index = states.indexOf("half");
      if (delta > 28) {
        /* משיכה מעלה — מצב רחב יותר; מהרחב ביותר: המשך מוגדר */
        if (index >= states.length - 1) panel.style.height = "";
        else setSheetState(panel, kind, states[index + 1]);
      } else if (delta < -28) {
        /* משיכה מטה — מצב נמוך יותר; מהנמוך ביותר: סגירה מלאה */
        if (index <= 0) onLowest();
        else setSheetState(panel, kind, states[index - 1]);
      } else {
        panel.style.height = ""; /* תנועה קטנה — חזרה למצב הנוכחי */
      }
    });

    handle.addEventListener("pointercancel", function () {
      stopDrag();
      /* גרירה שבוטלה עשויה גם היא להותיר click תלוי אצל הדפדפן */
      suppressHandleClickUntil = Date.now() + SUPPRESS_CLICK_WINDOW_MS;
      panel.style.height = ""; /* חזרה מיידית למצב המוגדר */
    });

    /* הפעלה מהמקלדת (Enter/Space) אינה אחרית גרירה — הפוקוס מבטל החסימה */
    handle.addEventListener("focus", function () {
      suppressHandleClickUntil = 0;
    });
  }

  /** שורת הסיכום במצב המקופל: משמרת חיה של מונה התוצאות וההתקדמות */
  function refreshPeeks() {
    if (!railPeek) return;
    var countBtn = document.getElementById("result-count");
    var pctEl = document.getElementById("stat-pct");
    var text = countBtn && countBtn.textContent ? countBtn.textContent : "רשימת הרחובות";
    if (pctEl && pctEl.textContent) text += " · " + pctEl.textContent;
    if (railPeek.textContent !== text) railPeek.textContent = text;
  }

  /** הידיות והסיכום נבנים פעם אחת (ה-HTML המקורי נשאר ללא-שינוי עבור ללא-JS) */
  function ensureSheetChrome() {
    if (!rail.dataset.sheetChrome) {
      rail.dataset.sheetChrome = "true";
      railHandle = document.createElement("button");
      railHandle.type = "button";
      railHandle.className = "sheet-handle";
      railHandle.setAttribute("aria-label", SHEET_LABELS.rail.half);
      var railGrip = document.createElement("span");
      railGrip.className = "sheet-handle__grip";
      railGrip.setAttribute("aria-hidden", "true");
      railHandle.appendChild(railGrip);
      rail.insertBefore(railHandle, rail.firstChild);
      railHandle.addEventListener("click", handleCycleClick("rail"));
      attachSheetDrag(rail, "rail", railHandle, function () {
        if (railIsOpen()) closeRail();
      });

      railPeek = document.createElement("p");
      railPeek.className = "sheet-peek";
      var railTop = rail.querySelector(".rail__top");
      if (railTop) {
        var randomBtn = document.getElementById("random-street");
        if (randomBtn && randomBtn.parentElement === railTop) railTop.insertBefore(railPeek, randomBtn);
        else railTop.appendChild(railPeek);
      }
    }

    if (!infoDrawer.dataset.sheetChrome) {
      infoDrawer.dataset.sheetChrome = "true";
      drawerHandle = document.createElement("button");
      drawerHandle.type = "button";
      drawerHandle.className = "sheet-handle";
      drawerHandle.setAttribute("aria-label", SHEET_LABELS.drawer.half);
      var drawerGrip = document.createElement("span");
      drawerGrip.className = "sheet-handle__grip";
      drawerGrip.setAttribute("aria-hidden", "true");
      drawerHandle.appendChild(drawerGrip);
      infoDrawer.insertBefore(drawerHandle, infoDrawer.firstChild);
      drawerHandle.addEventListener("click", handleCycleClick("drawer"));
      attachSheetDrag(infoDrawer, "drawer", drawerHandle, function () {
        if (drawerIsOpen()) closeDrawer(true);
      });
    }
  }

  /* ---------- ארועים ---------- */

  var tabs = Array.prototype.slice.call(rail.querySelectorAll('[role="tab"]'));
  var stats = infoDrawer.querySelector('.stats');
  var progressPanel = document.getElementById('panel-progress');
  if (stats && progressPanel) progressPanel.appendChild(stats);

  function selectTab(tab, focus) {
    if (!tab) return;
    tabs.forEach(function (item) {
      var selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      var panel = document.getElementById(item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
    syncFilterToggle();
    if (focus) { flushStyles(rail); tab.focus(); }
  }
  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { selectTab(tab, false); });
    tab.addEventListener('keydown', function (event) {
      var next = index;
      if (event.key === 'ArrowLeft') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowRight') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[next], true);
    });
  });
  rail.querySelectorAll('[data-sheet-target]').forEach(function (button) {
    button.addEventListener('click', function () { setSheetState(rail, 'rail', button.dataset.sheetTarget); });
  });
  var filterToggle = document.getElementById('filter-toggle');
  if (filterToggle) filterToggle.addEventListener('click', function () {
    openRail();
    selectTab(document.getElementById('tab-filters'), true);
  });
  var search = document.getElementById('search');
  if (search) search.addEventListener('input', function () {
    if (!search.value.trim()) return;
    openRail();
    selectTab(document.getElementById('tab-streets'), false);
  });
  document.addEventListener('click', function (event) {
    if (event.target.closest && event.target.closest('.map-popup__find, #random-street')) {
      openRail();
      selectTab(document.getElementById('tab-streets'), false);
    }
  }, true);
  var topbar = document.querySelector('.topbar');
  function measureToolbar() {
    if (topbar) document.documentElement.style.setProperty('--toolbar-bottom', Math.ceil(topbar.getBoundingClientRect().bottom) + 'px');
  }
  if (topbar && typeof window.ResizeObserver === 'function') new window.ResizeObserver(measureToolbar).observe(topbar);
  window.addEventListener('resize', measureToolbar);
  measureToolbar();
  document.addEventListener('jlm-reveal-street-list', function () {
    openRail();
    selectTab(document.getElementById('tab-streets'), false);
    flushStyles(rail);
  });
  document.addEventListener('jlm-map-selection', function () {
    if (isMobile() && railIsOpen()) setSheetState(rail, 'rail', 'collapsed');
  });
  document.addEventListener('keydown', function (event) {
    var target = event.target;
    if (event.defaultPrevented || drawerIsOpen() || document.querySelector('.map-review-backdrop, .dyk-modal:not([hidden])')) return;
    var editable = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (!editable && !event.ctrlKey && !event.metaKey && !event.altKey && (event.code === 'KeyR' || event.key.toLowerCase() === 'r')) {
      openRail();
      selectTab(document.getElementById('tab-streets'), false);
      flushStyles(rail);
    }
  }, true);

  listToggle.addEventListener("click", toggleRail);
  infoToggle.addEventListener("click", toggleDrawer);

  if (railClose) railClose.addEventListener("click", function () { closeRail(); if (isMobile()) infoToggle.focus(); });
  if (infoClose) infoClose.addEventListener("click", function () { closeDrawer(true); });

  scrim.addEventListener("click", function () {
    if (drawerIsOpen()) closeDrawer(true);
    else if (railIsOpen()) closeRail();
  });

  document.addEventListener("keydown", function (event) {
    if (event.defaultPrevented) return;
    var key = event.key;
    if (key === "Escape" || key === "Esc") {
      if (document.querySelector('.map-review-backdrop, .dyk-modal:not([hidden])')) return;
      if (drawerIsOpen()) {
        event.stopPropagation();
        closeDrawer(true);
        return;
      }
      var target = event.target;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (isMobile() && railIsOpen()) {
        event.stopPropagation();
        closeRail();
        listToggle.focus();
      }
      return;
    }
    if (key === "Tab") trapFocusInDrawer(event);
  });

  /* פתיחה אוטומטית כשמיקוד נכנס לפאנל סגור (קישורי דילוג, קיצורי מקלדת,
     קפיצה לרחוב תוצאות חיפוש) — שומר את זרימת הפוקוס תקינה בכל מכשיר. */
  document.addEventListener("focusin", function (event) {
    var target = event.target;
    if (!target) return;
    if (rail.contains(target) && !railIsOpen()) openRail();
    if (infoDrawer.contains(target) && infoDrawer.hidden) openDrawer(null);
  });

  /* קישורי עוגן וכפתור מונה התוצאות צריכים לגלות פאנל סגור לפני הקפיצה */
  function anchorToPanel(a) {
    var href = a.getAttribute("href") || "";
    if (href.length < 2) return;
    var targetEl = document.getElementById(href.slice(1));
    if (!targetEl) return;
    if (rail.contains(targetEl)) {
      var panel = targetEl.closest('[role="tabpanel"]');
      if (panel) selectTab(document.getElementById(panel.getAttribute('aria-labelledby')), false);
    }
    if (rail.contains(targetEl) && !railIsOpen()) openRail();
    if (infoDrawer.contains(targetEl) && infoDrawer.hidden) openDrawer(null);
  }

  Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (a) {
    a.addEventListener("click", function () {
      anchorToPanel(a);
      var href = a.getAttribute("href") || "";
      var targetEl = href.length > 1 && document.getElementById(href.slice(1));
      if (targetEl && typeof targetEl.focus === "function") {
        flushStyles(rail.contains(targetEl) ? rail : infoDrawer);
        targetEl.focus();
        /* אנימציית החזרת המגירה למסך עודדות visibility שנע בחזרה — ניסיון שני בסיומה */
        if (document.activeElement !== targetEl) {
          window.setTimeout(function () { targetEl.focus(); }, 300);
        }
      }
    });
  });

  var resultCountBtn = document.getElementById("result-count");
  if (resultCountBtn) {
    resultCountBtn.addEventListener("click", function () {
      if (!railIsOpen()) openRail();
      selectTab(document.getElementById('tab-streets'), false);
    });
  }

  /* קיצור המקש ‎?‎ פותח את רשימת הקיצורים — היא חיה בתוך פאנל המידע, ולכן
     הפאנל נפתח עם הקיצור והמיקוד קופץ ישירות לכותרת הרשימה */
  var shortcutsBox = document.getElementById("shortcuts-details");
  if (shortcutsBox) {
    shortcutsBox.addEventListener("toggle", function () {
      if (!shortcutsBox.open) return;
      if (infoDrawer.hidden) openDrawer(null);
      var summaryEl = shortcutsBox.querySelector("summary");
      if (summaryEl) {
        flushStyles(infoDrawer);
        window.setTimeout(function () { summaryEl.focus(); }, 40);
      }
    });
  }

  /* מצב התחלתי: הסרגל פתוח ובמובייל מוצג בחצי גובה.
     ה-HTML נשלח עם is-closed לשמירה על בסיס ללא-JS, וכאן מתיישר. */
  ensureSheetChrome();
  if (typeof window.MutationObserver === "function") {
    var peekObserver = new window.MutationObserver(refreshPeeks);
    ["result-count", "stat-pct"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) peekObserver.observe(node, { childList: true, characterData: true, subtree: true });
    });
  }
  refreshPeeks();
  openRail();
  setSheetState(rail, 'rail', 'half');
  scrim.setAttribute("hidden", "");

  var onBreakpointChange = function () {
    /* חציית נקודת השבר לא משנה את בחירת המשתמש — רק מסנכרן את המיסוך */
    syncScrim();
  };
  if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", onBreakpointChange);
  } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
    mobileQuery.addListener(onBreakpointChange);
  }

  syncToggle(listToggle, railIsOpen());
  syncToggle(infoToggle, drawerIsOpen());
})();
