/**
 * כלי סביבת הבטא — נטען אך ורק מ-beta.html (שנוצר מ-app.html).
 *
 * הפאנל מאפשר לבדוק את האפליקציה לפני שהיא עולה לאתר הציבורי:
 * תצוגת מכשיר בחלון בגודל אמיתי, נתוני בדיקה נפרדים, ייצוא/ייבוא מצב,
 * וקישור לאתר הציבורי. הנתונים נשמרים במפתח נפרד (JLM_BETA ב-store.js)
 * ולכן אינם נוגעים ביומן האמיתי של המשתמש.
 */
(function () {
  "use strict";

  if (!window.JLM_BETA) return;

  var params = new URLSearchParams(window.location.search);
  var deviceMode = params.get("device") === "1";

  var CSS = [
    ".beta-badge{position:fixed;inset-block-start:10px;inset-inline-end:10px;z-index:9998;",
    "display:inline-flex;align-items:center;gap:.35rem;padding:.3rem .6rem;border-radius:999px;",
    "background:#2a211b;color:#f7efe6;border:1px solid #6b5241;font:600 .78rem/1.2 system-ui,sans-serif;",
    "text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.25)}",
    ".beta-badge:hover{background:#3a2d24;color:#fff}",
    ".beta-panel{position:fixed;inset-block-end:14px;inset-inline-start:14px;z-index:9999;",
    "width:300px;max-width:calc(100vw - 28px);max-height:82vh;overflow:auto;",
    "background:#221b16;color:#f7efe6;border:1px solid #5d4a3c;border-radius:14px;",
    "box-shadow:0 10px 30px rgba(0,0,0,.4);padding:12px 14px;",
    "font:14px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;direction:rtl;text-align:right}",
    ".beta-panel h2{margin:0 0 2px;font-size:1rem;display:flex;align-items:center;justify-content:space-between;gap:.5rem}",
    ".beta-panel h2 button{background:transparent;border:0;color:#cbb8a8;font-size:1.1rem;cursor:pointer;padding:4px 6px;border-radius:6px}",
    ".beta-panel h2 button:hover{background:#3a2d24;color:#fff}",
    ".beta-note{margin:0 0 10px;color:#cbb8a8;font-size:.78rem}",
    ".beta-group{border-top:1px solid #3f3228;padding-block-start:9px;margin-block-start:9px}",
    ".beta-label{display:block;font-size:.74rem;letter-spacing:.02em;color:#c9a888;margin-block-end:6px}",
    ".beta-row{display:flex;flex-wrap:wrap;gap:6px;margin-block-end:6px}",
    ".beta-row button{flex:1 1 auto;min-height:38px;padding:.35rem .55rem;border-radius:8px;cursor:pointer;",
    "background:#33281f;color:#f7efe6;border:1px solid #5d4a3c;font:inherit;font-size:.8rem}",
    ".beta-row button:hover{background:#413229;border-color:#8a6a50}",
    ".beta-row button:focus-visible,.beta-links a:focus-visible{outline:2px solid #e39a55;outline-offset:2px}",
    ".beta-hint{margin:0 0 4px;color:#a89280;font-size:.72rem}",
    ".beta-status{margin:6px 0 0;font-size:.76rem;color:#f0b27a;min-height:1em}",
    ".beta-info{margin:6px 0 0;font-size:.72rem;color:#a89280;word-break:break-word}",
    ".beta-links{display:flex;gap:14px;margin-block-start:10px;font-size:.8rem}",
    ".beta-links a{color:#f0b27a}",
    ".beta-toggle{position:fixed;inset-block-end:14px;inset-inline-start:14px;z-index:9999;",
    "width:46px;height:46px;border-radius:50%;border:1px solid #6b5241;background:#221b16;color:#f7efe6;",
    "font:700 1rem/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35)}",
    ".beta-toggle:hover{background:#3a2d24}"
  ].join("");

  function addStyles() {
    var style = document.createElement("style");
    style.id = "beta-tools-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function makeBadge() {
    var badge = document.createElement("a");
    badge.className = "beta-badge";
    badge.href = "beta.html";
    badge.textContent = "β · סביבת בטא";
    badge.title = deviceMode ? "חזרה לפאנל הבטא" : "סביבת בדיקה — לא האתר הציבורי";
    document.body.appendChild(badge);
    return badge;
  }

  function statusLine(el) {
    var timer = 0;
    return function (message) {
      el.textContent = message;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { el.textContent = ""; }, 6000);
    };
  }

  function openDevice(width, height, setStatus) {
    var win = window.open(
      "beta.html?device=1",
      "jlm-beta-device",
      "popup=yes,width=" + width + ",height=" + height + ",left=80,top=60"
    );
    if (!win) {
      setStatus("הדפדפן חסם את החלון — אפשרו חלונות קופצים ונסו שוב.");
      return;
    }
    try { win.resizeTo(width, height); } catch (error) { /* מותר לדפדפן לסרב */ }
    try { win.focus(); } catch (error) { /* לא קריטי */ }
    setStatus("נפתח חלון בגודל " + width + "×" + height + ".");
  }

  function seedVisits(setStatus) {
    if (!window.JLMAPI || !window.JLMStore) {
      setStatus("האפליקציה עוד לא נטענה — נסו שוב בעוד רגע.");
      return;
    }
    var streets = window.JLMAPI.getStreets();
    if (!streets.length) {
      setStatus("אין רחובות לטעינה.");
      return;
    }

    var result = window.JLMStore.load();
    var state = result.state;
    var pool = streets.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }

    var today = new Date().toISOString().slice(0, 10);
    var added = 0;
    for (var k = 0; k < pool.length && added < 25; k++) {
      var id = pool[k].id;
      if (state.visited[id]) continue;
      state.visited[id] = { date: today, note: "", rating: 0, mood: "" };
      added++;
    }

    if (!window.JLMStore.save(state)) {
      setStatus("שמירת נתוני הדוגמה נכשלה.");
      return;
    }
    window.location.reload();
  }

  function resetData(setStatus) {
    if (!window.JLMStore) return;
    if (!window.confirm("לאפס את נתוני סביבת הבטא? היומן האמיתי באתר הציבורי לא ייפגע.")) return;
    window.JLMStore.clear();
    setStatus("נתוני הבטא נמחקו — מרענן…");
    window.location.reload();
  }

  function exportState(setStatus) {
    if (!window.JLMStore) return;
    var state = window.JLMStore.load().state;
    var text = window.JLMStore.toJSON(state);
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "jlm-beta-state.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    setStatus("המצב יוצא לקובץ.");
  }

  function importState(file, setStatus) {
    if (!file || !window.JLMStore) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed = window.JLMStore.fromJSON(String(reader.result || ""));
      if (!parsed.ok) {
        setStatus("הייבוא נכשל: " + parsed.error);
        return;
      }
      if (!window.JLMStore.save(parsed.state)) {
        setStatus("שמירת המצב המיובא נכשלה.");
        return;
      }
      setStatus("המצב יובא — מרענן…");
      window.location.reload();
    };
    reader.onerror = function () { setStatus("קריאת הקובץ נכשלה."); };
    reader.readAsText(file);
  }

  function refreshInfo(element) {
    var total = 0;
    var visited = 0;
    if (window.JLMAPI && typeof window.JLMAPI.getStreets === "function") {
      var streets = window.JLMAPI.getStreets();
      total = streets.length;
      for (var i = 0; i < streets.length; i++) {
        if (window.JLMAPI.isVisited(streets[i].id)) visited++;
      }
    }
    var key = window.JLMStore ? window.JLMStore.KEY : "";
    element.textContent = "מסומנים: " + visited + " מתוך " + total + " · מפתח נתונים: " + key;
  }

  function buildPanel() {
    var panel = document.createElement("aside");
    panel.className = "beta-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "כלי סביבת הבטא");

    var head = document.createElement("h2");
    head.appendChild(document.createTextNode("סביבת בטא"));
    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "סגור את פאנל הבטא");
    head.appendChild(close);
    panel.appendChild(head);

    var note = document.createElement("p");
    note.className = "beta-note";
    note.textContent = "כאן בודקים שינויים לפני פרסום. הנתונים נשמרים בנפרד ואינם נוגעים ביומן האתר הציבורי.";
    panel.appendChild(note);

    var status = document.createElement("p");
    status.className = "beta-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    var setStatus = statusLine(status);

    // תצוגת מכשיר
    var deviceGroup = document.createElement("div");
    deviceGroup.className = "beta-group";
    var deviceLabel = document.createElement("span");
    deviceLabel.className = "beta-label";
    deviceLabel.textContent = "תצוגת מכשיר — חלון בגודל אמיתי";
    deviceGroup.appendChild(deviceLabel);

    var deviceRow = document.createElement("div");
    deviceRow.className = "beta-row";
    [
      ["טלפון 390", 390, 844],
      ["טלפון גדול", 430, 932],
      ["טאבלט 820", 820, 1180]
    ].forEach(function (preset) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = preset[0];
      button.addEventListener("click", function () { openDevice(preset[1], preset[2], setStatus); });
      deviceRow.appendChild(button);
    });
    deviceGroup.appendChild(deviceRow);

    var deviceHint = document.createElement("p");
    deviceHint.className = "beta-hint";
    deviceHint.textContent = "נפתח חלון נפרד ברוחב המכשיר; אפשר לשנות גודל ידנית.";
    deviceGroup.appendChild(deviceHint);
    panel.appendChild(deviceGroup);

    // נתוני בדיקה
    var dataGroup = document.createElement("div");
    dataGroup.className = "beta-group";
    var dataLabel = document.createElement("span");
    dataLabel.className = "beta-label";
    dataLabel.textContent = "נתוני בדיקה";
    dataGroup.appendChild(dataLabel);

    var dataRow = document.createElement("div");
    dataRow.className = "beta-row";

    var seed = document.createElement("button");
    seed.type = "button";
    seed.textContent = "25 ביקורים לדוגמה";
    seed.addEventListener("click", function () { seedVisits(setStatus); });
    dataRow.appendChild(seed);

    var reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "איפוס נתוני בטא";
    reset.addEventListener("click", function () { resetData(setStatus); });
    dataRow.appendChild(reset);
    dataGroup.appendChild(dataRow);

    var fileRow = document.createElement("div");
    fileRow.className = "beta-row";

    var exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "ייצוא JSON";
    exportButton.addEventListener("click", function () { exportState(setStatus); });
    fileRow.appendChild(exportButton);

    var importButton = document.createElement("button");
    importButton.type = "button";
    importButton.textContent = "ייבוא JSON";
    fileRow.appendChild(importButton);

    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json,.json";
    fileInput.hidden = true;
    fileInput.addEventListener("change", function () {
      importState(fileInput.files && fileInput.files[0], setStatus);
      fileInput.value = "";
    });
    importButton.addEventListener("click", function () { fileInput.click(); });
    fileRow.appendChild(fileInput);
    dataGroup.appendChild(fileRow);
    panel.appendChild(dataGroup);

    var info = document.createElement("p");
    info.className = "beta-info";
    panel.appendChild(info);

    panel.appendChild(status);

    var links = document.createElement("div");
    links.className = "beta-links";
    var publicLink = document.createElement("a");
    publicLink.href = "app.html";
    publicLink.textContent = "לאתר הציבורי";
    links.appendChild(publicLink);

    var reload = document.createElement("a");
    reload.href = "#";
    reload.textContent = "רענון";
    reload.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.reload();
    });
    links.appendChild(reload);
    panel.appendChild(links);

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "beta-toggle";
    toggle.textContent = "β";
    toggle.hidden = true;
    toggle.setAttribute("aria-label", "פתח את פאנל הבטא");

    function showPanel(show) {
      panel.hidden = !show;
      toggle.hidden = show;
      if (show) refreshInfo(info);
    }

    close.addEventListener("click", function () { showPanel(false); toggle.focus(); });
    toggle.addEventListener("click", function () { showPanel(true); close.focus(); });
    document.addEventListener("keydown", function (event) {
      if (event.altKey && (event.key === "b" || event.key === "B")) {
        event.preventDefault();
        showPanel(panel.hidden);
      }
      if (event.key === "Escape" && !panel.hidden) {
        showPanel(false);
        toggle.focus();
      }
    });

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    refreshInfo(info);
    window.setInterval(function () {
      if (!panel.hidden) refreshInfo(info);
    }, 2000);
  }

  function init() {
    addStyles();
    makeBadge();

    // בחלון תצוגת מכשיר: בלי פאנל, כדי לראות את האפליקציה כמו שהיא.
    if (deviceMode) return;

    buildPanel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
