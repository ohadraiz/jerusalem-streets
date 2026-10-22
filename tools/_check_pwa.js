const fs = require("fs");
const s = fs.readFileSync("index.html", "utf8");
const target = '<script src="assets/pwa.js" defer></script>';
console.log("includes:", s.includes(target));
console.log("index:", s.indexOf(target));