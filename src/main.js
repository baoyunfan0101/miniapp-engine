// src/main.js
import "./style.css";

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

function renderTree(tree) {
  root.innerHTML = "";

  function mount(node, container) {
    if (node.type === "view") {
      const div = document.createElement("div");
      (node.children || []).forEach((c) => mount(c, div));
      container.appendChild(div);
    } else if (node.type === "text") {
      const span = document.createElement("span");
      span.textContent = node.value;
      container.appendChild(span);
    } else if (node.type === "button") {
      const btn = document.createElement("button");
      btn.textContent = node.text;
      btn.onclick = () => {
        worker.postMessage({ type: "EVENT", name: node.event, payload: {} });
      };
      container.appendChild(document.createElement("br"));
      container.appendChild(btn);
    }
  }

  mount(tree, root);
}

worker.onmessage = (e) => {
  const msg = e.data;

  if (msg.type === "RENDER") {
    renderTree(msg.tree);
  }

  logEl.textContent += JSON.stringify(msg) + "\n";
};

worker.postMessage({ type: "EXECUTE_APP", entry: new URL("./app.js", import.meta.url).href });