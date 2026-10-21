import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = mkdtempSync(join(tmpdir(), "jlm-034-"));
console.log("profile", profile);
const c = spawn(CHROME, ["--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--remote-debugging-port=9344","--remote-allow-origins=*","--user-data-dir=" + profile,"about:blank"], { stdio: "ignore", windowsHide: true });
c.on("error", (e) => console.log("SPAWN ERROR", e.message));
c.on("exit", (code) => console.log("EXIT", code));
await new Promise(r => setTimeout(r, 5000));
try { const res = await fetch("http://127.0.0.1:9344/json/version"); console.log("OK", res.status, (await res.text()).slice(0,80)); } catch (e) { console.log("FETCH ERR", e.message); }
c.kill();