/**
 * חוויית התקנה — "רחובות ירושלים".
 *
 * שכבת UI עצמאית: אינה נוגעת בנתונים, באחסון או ב-JLMAPI.
 * מציגה כפתור התקנה כש-Android/Chromium מאפשרים אותו, הוראות ידניות
 * ב-iOS, ומסתירה את עצמה כשהאתר כבר פועל כ-PWA מותקן.
 *
 * השינוי מוצג ונבדק קודם ב-beta או ב-localhost; beta.html עצמו אינו
 * טוען את הקובץ הזה ואינו אמור להיות אתר מותקן.
 */
(function () {
  "use strict";

  // אין התקנה אמיתית מ-file://; האפליקציה עצמה ממשיכה לעבוד שם כרגיל.
  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") return;

  var SESSION_KEY = window.JLM_BETA
    ? "jlm-pwa-install-dismissed-beta-v1"
    : "jlm-pwa-install-dismissed-v1";
  var SHOW_DELAY = 1200;
  var MANUAL_FALLBACK_DELAY = 3000;

  var displayMode = window.matchMedia ? window.matchMedia("(display-mode: standalone)") : null;
  var deferredPrompt = null;
  var dismissed = readDismissed();
  var banner = null;
  var titleEl = null;
  var bodyEl = null;
  var primaryEl = null;
  var secondaryEl = null;
  var currentMode = "";
  var toastObserver = null;
  var manualTimer = 0;

  function readDismissed() {
    try {
      return window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function rememberDismissed() {
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch (error) {
      /* אין sessionStorage — לא חוסם את האפליקציה */
    }
  }

  function isStandalone() {
    return Boolean(displayMode && displayMode.matches) || window.navigator.standalone === true;
  }

  function isIOS() {
    var ua = window.navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  }

  function isAndroid() {
    return /Android/i.test(window.navigator.userAgent || "");
  }

  function show(mode) {
    if (dismissed || isStandalone()) return;

    if (!document.body) {
      document.addEventListener("DOMContentLoaded", function () {
        show(mode);
      });
      return;
    }

    buildBanner();
    currentMode = mode;

    if (mode === "prompt") {
      setText(
        "להתקין את יומן הרחובות?",
        "גישה מהירה ליומן, גם בלי חיבור לאינטרנט.",
        "התקנה"
      );
      secondaryEl.hidden = false;
    } else if (mode === "ios") {
      setText(
        "אפשר להוסיף את האתר למסך הבית",
        "ב-Safari: לחצו על כפתור השיתוף (ריבוע עם חץ) ובחרו „הוספה למסך הבית”.",
        "הבנתי"
      );
      secondaryEl.hidden = true;
    } else {
      setText(
        "אפשר להוסיף את האתר למסך הבית",
        "פתחו את תפריט הדפדפן (⋮) ובחרו „הוספה למסך הבית”.",
        "הבנתי"
      );
      secondaryEl.hidden = true;
    }

    banner.hidden = false;
    document.body.classList.add("has-pwa-install");
    syncToast();
  }

  function setText(title, body, primaryLabel) {
    titleEl.textContent = title;
    bodyEl.textContent = body;
    primaryEl.textContent = primaryLabel;
  }

  function hide() {
    window.clearTimeout(manualTimer);
    if (banner) banner.hidden = true;
    if (document.body) document.body.classList.remove("has-pwa-install");
  }

  function dismiss() {
    dismissed = true;
    rememberDismissed();
    hide();
  }

  function buildBanner() {
    if (banner) return;

    banner = document.createElement("aside");
    banner.className = "pwa-install";
    banner.id = "pwa-install";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-labelledby", "pwa-install-title");
    banner.setAttribute("aria-describedby", "pwa-install-body");
    banner.hidden = true;

    var text = document.createElement("div");
    text.className = "pwa-install__text";

    titleEl = document.createElement("p");
    titleEl.className = "pwa-install__title";
    titleEl.id = "pwa-install-title";

    bodyEl = document.createElement("p");
    bodyEl.className = "pwa-install__body";
    bodyEl.id = "pwa-install-body";

    text.appendChild(titleEl);
    text.appendChild(bodyEl);

    var actions = document.createElement("div");
    actions.className = "pwa-install__actions";

    primaryEl = document.createElement("button");
    primaryEl.type = "button";
    primaryEl.className = "btn btn--small";
    primaryEl.id = "pwa-install-action";
    primaryEl.addEventListener("click", handlePrimary);

    secondaryEl = document.createElement("button");
    secondaryEl.type = "button";
    secondaryEl.className = "btn btn--quiet btn--small";
    secondaryEl.id = "pwa-install-dismiss";
    secondaryEl.textContent = "לא עכשיו";
    secondaryEl.addEventListener("click", dismiss);

    actions.appendChild(primaryEl);
    actions.appendChild(secondaryEl);
    banner.appendChild(text);
    banner.appendChild(actions);

    document.body.appendChild(banner);
    watchToast();
  }

  function handlePrimary() {
    if (currentMode === "prompt" && deferredPrompt) {
      promptInstall();
      return;
    }
    dismiss();
  }

  function promptInstall() {
    var promptEvent = deferredPrompt;
    deferredPrompt = null;
    window.clearTimeout(manualTimer);
    hide();

    if (!promptEvent || typeof promptEvent.prompt !== "function") {
      dismiss();
      return;
    }

    promptEvent.prompt();

    if (promptEvent.userChoice && typeof promptEvent.userChoice.then === "function") {
      promptEvent.userChoice
        .then(function () {
          // בין שהמשתמש אישר ובין שדחה — לא מציקים שוב באותו סשן.
          dismissed = true;
          rememberDismissed();
        })
        .catch(function () {
          dismissed = true;
          rememberDismissed();
        });
    } else {
      dismissed = true;
      rememberDismissed();
    }
  }

  function syncToast() {
    if (!banner) return;
    var toast = document.getElementById("toast");
    var toastOpen = Boolean(toast && !toast.hidden);
    banner.classList.toggle("is-suppressed", toastOpen);
  }

  function watchToast() {
    if (toastObserver) return;
    var toast = document.getElementById("toast");
    if (!toast) return;

    if (typeof window.MutationObserver === "function") {
      toastObserver = new window.MutationObserver(syncToast);
      toastObserver.observe(toast, { attributes: true, attributeFilter: ["hidden"] });
    }
    syncToast();
  }

  function scheduleManualFallback() {
    if (dismissed || isStandalone() || deferredPrompt) return;
    if (!isIOS() && !isAndroid()) return;
    manualTimer = window.setTimeout(function () {
      if (!dismissed && !deferredPrompt) show(isIOS() ? "ios" : "manual");
    }, MANUAL_FALLBACK_DELAY);
  }

  function onDisplayModeChange() {
    if (isStandalone()) {
      dismissed = true;
      rememberDismissed();
      hide();
    }
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    window.clearTimeout(manualTimer);
    show("prompt");
  });

  window.addEventListener("appinstalled", function () {
    dismissed = true;
    rememberDismissed();
    hide();
  });

  if (displayMode) {
    if (typeof displayMode.addEventListener === "function") {
      displayMode.addEventListener("change", onDisplayModeChange);
    } else if (typeof displayMode.addListener === "function") {
      displayMode.addListener(onDisplayModeChange);
    }
  }

  function init() {
    if (dismissed || isStandalone()) return;
    watchToast();

    if (isIOS()) {
      window.setTimeout(function () {
        if (!dismissed && !deferredPrompt) show("ios");
      }, SHOW_DELAY);
      return;
    }

    // ב-Android ללא beforeinstallprompt (למשל בסביבת הבטא, שבה
    // ה-manifest מוסר) עדיין אפשר להציע את נתיב ההתקנה הידני.
    scheduleManualFallback();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
