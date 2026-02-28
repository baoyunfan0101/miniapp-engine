// src/main.js

import "./style.css";
import { MSG, ERR } from "./shared/protocol.js";
import { render } from "./renderer/index.js";

document.querySelector("#app").innerHTML = `
  <div style="font-family: ui-sans-serif; line-height: 1.6;">
    <h2>miniapp-engine</h2>
    <p>https://github.com/baoyunfan0101/miniapp-engine</p>
    <div id="root"></div>
    <pre id="log" style="background:#f6f6f6;padding:12px;border-radius:8px;"></pre>
  </div>
`;

const root = document.querySelector("#root");
const logEl = document.querySelector("#log");

const worker = new Worker(new URL("./worker.js", import.meta.url), {
  type: "module",
});

worker.onmessage = (e) => {
  const msg = e.data;

  if (msg.type === MSG.ERROR) {
    console.error(msg.code, msg.message);
    if (msg.meta) console.error("meta:", msg.meta);
    if (msg.stack) console.error(msg.stack);
    return;
  }

  if (msg.type === MSG.RENDER) {
    try {
      render(msg.tree, root, worker);
    } catch (err) {
      console.error(`[${ERR.RENDER_FAIL}]`, err);
      logEl.textContent += `[${ERR.RENDER_FAIL}] ${err.message}\n`;
    }
  }

  logEl.textContent += JSON.stringify(msg) + "\n";
  console.log("Received message from worker:", msg);
};

worker.postMessage({ type: MSG.EXECUTE_APP, entry: new URL("./app.js", import.meta.url).href });