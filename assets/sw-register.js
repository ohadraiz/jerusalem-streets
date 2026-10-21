/**
 * רישום Service Worker — "רחובות ירושלים".
 *
 * רק ב-HTTPS או ב-localhost. ב-`file://` אין רישום כלל (אין הקשר מאובטח),
 * והאפליקציה עובדת במלואה גם כך.
 *
 * הרישום נכשל אינו מפיל דבר: האפליקציה עובדת גם בלי Service Worker.
 */
(function () {
  "use strict";

  if (!("serviceWorker" in navigator)) return;

  var protocol = window.location.protocol;
  if (protocol !== "https:" && protocol !== "http:") return; // file:// — לא נרשמים

  function register() {
    navigator.serviceWorker.register("sw.js").catch(function () {
      /* שקט: אין SW = אין עבודה במצב לא מקוון, והכול עובד */
    });
  }

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register);
  }
})();
