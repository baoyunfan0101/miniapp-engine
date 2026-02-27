// src/main.js

import "./style.css";
import { render } from "./renderer/index.js";

document.querySelector("#app").innerHTML = `
  <div style="font-family: ui-sans-serif; line-height: 1.6;">
    <h2>MiniApp - App Runtime</h2>
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

  if (msg.type === "RENDER") {
    render(msg.tree, root, worker);
  }

  logEl.textContent += JSON.stringify(msg) + "\n";
};

worker.postMessage({ type: "EXECUTE_APP", entry: new URL("./app.js", import.meta.url).href });