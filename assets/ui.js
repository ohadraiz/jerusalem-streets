/**
 * שכבת ממשק נוספת (טעינה אחרי app.js ו-map.js).
 * מדידת גובה סרגל החיפוש והזנתו ל-CSS (--sticky-h), כדי שכותרת הרשימה
 * וכפתור "חזרה לכל הרחובות" לא ייכנסו מתחת לסרגל הדביק בגלילה.
 * החיפוש נמצא מתחת למפה, ולכן אין צורך להסתיר אותו כשהמפה על המסך.
 * לא נוגע בנתונים, באחסון ובמפה.
 */
(function () {
  "use strict";

  var bar = document.querySelector(".searchbar");
  if (!bar) return;

  var root = document.documentElement;
  var stickyQuery = window.matchMedia ? window.matchMedia("(max-width: 620px)") : null;

  /** גובה הסרגל הדביק — נכנס ל-CSS כדי שיעדי גלילה לא ייכנסו מתחתיו */
  function syncStickyOffset() {
    if (!stickyQuery || !stickyQuery.matches) {
      root.style.removeProperty("--sticky-h");
      return;
    }
    var height = Math.ceil(bar.getBoundingClientRect().height);
    if (!height) return;
    if (root.style.getPropertyValue("--sticky-h") === height + "px") return;
    root.style.setProperty("--sticky-h", height + "px");
  }

  window.addEventListener("resize", syncStickyOffset);
  window.addEventListener("orientationchange", syncStickyOffset);

  /* בטלפון הסרגל מתקפל בזמן גלילה מטה, ונפתח מיד כשחוזרים מעלה.
     כך נשאר יותר מקום לתוכן בלי לאבד חיפוש מהיר. */
  var scrollFrame = 0;
  var lastScrollY = window.scrollY || 0;
  function syncScrollVisibility() {
    scrollFrame = 0;
    if (!stickyQuery || !stickyQuery.matches) {
      bar.classList.remove("is-scroll-hidden");
      return;
    }
    var currentY = Math.max(0, window.scrollY || 0);
    var movingDown = currentY > lastScrollY + 4;
    var movingUp = currentY < lastScrollY - 4;
    if (currentY < 80 || movingUp || document.activeElement === bar.querySelector("input")) {
      bar.classList.remove("is-scroll-hidden");
    } else if (movingDown) {
      bar.classList.add("is-scroll-hidden");
    }
    lastScrollY = currentY;
  }
  function onScroll() {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(syncScrollVisibility);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  bar.addEventListener("focusin", function () { bar.classList.remove("is-scroll-hidden"); });

  syncStickyOffset();
  window.setTimeout(syncStickyOffset, 400);
})();
