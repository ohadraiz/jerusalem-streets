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

  syncStickyOffset();
  window.setTimeout(syncStickyOffset, 400);
})();
