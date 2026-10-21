import { spawn } from "node:child_process";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const c = spawn(CHROME, ["--headless=new","--disable-gpu","--no-first-run","--remote-debugging-port=9356","--user-data-dir=C:\\Users\\ohadr\\AppData\\Local\\Temp\\opencode\\chr035","about:blank"], { stdio: ["ignore","pipe","pipe"] });
c.stderr.on("data", (d) => console.log("ERR:", String(d).slice(0,400)));
c.on("error", (e) => console.log("SPAWN ERROR", e.message));
await new Promise(r => setTimeout(r, 4000));
try { const res = await fetch("http://127.0.0.1:9356/json/version"); console.log("OK", res.status); } catch (e) { console.log("FETCH ERR", e.message); }
c.kill();