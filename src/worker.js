// src/worker.js

import { MSG, ERR } from "./shared/protocol.js";
import { compile } from "./compiler/index.js";
import { evaluate } from "./runtime/evaluate.js";

/* Error reporter */
function reportError(err, code, meta) {
  postMessage({
    type: MSG.ERROR,
    code,
    message: err?.message ? `[${code}] ${err.message}` : `[${code}] ${String(err)}`,
    stack: err?.stack ?? "",
    meta: meta ?? {},
  });
}

/* Module loader */
// cache loaded modules to avoid duplicate and concurrent imports
const moduleCache = new Map();

// specifier: imported module, e.g. "./app.js"
// referrer: importing module, e.g. "http://localhost:5173/src/worker.js"
async function loadModule(specifier, referrer) {
  const url = new URL(specifier, referrer).href;

  if (moduleCache.has(url)) return moduleCache.get(url);

  const p = import(/* @vite-ignore */ url);

  moduleCache.set(url, p);
  return p;
}

/* Runtime */
let appRuntime = null;

function createRuntime() {
  const runtime = {
    template: "",
    ir: null,
    data: {},
    handlers: new Map(),

    setTemplate(tpl) {
      try {
        runtime.template = String(tpl ?? "");
        runtime.ir = compile(runtime.template);
      } catch (err) {
        reportError(err, ERR.COMPILE_FAIL, { phase: "COMPILE" });
        runtime.ir = null;
      }
    },

    setData(patch) {
      // merge new values into a new object
      runtime.data = { ...runtime.data, ...patch };
      runtime.render();
    },

    onEvent(name, fn) {
      runtime.handlers.set(name, fn);
    },

    render() {
      try {
        if (!runtime.ir) throw new Error("Template not set");

        let tree;
        try {
          tree = evaluate(runtime.ir, runtime.data);
        } catch (err) {
          reportError(err, ERR.EVALUATE_FAIL, { phase: "EVALUATE" });
          return;
        }

        postMessage({ type: MSG.RENDER, tree });
      } catch (err) {
        reportError(err, ERR.RENDER_FAIL, { phase: "RENDER" });
      }
    },
  };

  return runtime;
}

/* Message handler */
onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === MSG.EXECUTE_APP) {
    try {
      const mod = await loadModule(msg.entry, self.location.href);

      try {
        appRuntime = createRuntime();
        mod.createApp(appRuntime);
      } catch (err) {
        reportError(err, ERR.RUN_FAIL, { phase: "CREATE_APP" });
      }
    } catch (err) {
      reportError(err, ERR.LOAD_FAIL, { phase: "LOAD_MODULE" });
    }
  }

  if (msg.type === MSG.EVENT) {
    if (!appRuntime) return;

    try {
      const handler = appRuntime.handlers.get(msg.name);
      if (handler) handler(msg.payload);
    } catch (err) {
      reportError(err, ERR.RUN_FAIL, { phase: "EVENT_HANDLER", event: msg.name });
    }
  }
};