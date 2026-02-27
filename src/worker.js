// src/worker.js

/* Module loader */
// cache loaded modules to avoid duplicate and concurrent imports
const moduleCache = new Map();

// specifier: imported module, e.g. "./app.js"
// referrer: importing module, e.g. "http://localhost:5173/src/worker.js"
async function loadModule(specifier, referrer) {
  const url = new URL(specifier, referrer).href;

  if (moduleCache.has(url))
    return moduleCache.get(url);

  const p = import(url);

  moduleCache.set(url, p);
  return p;
}

/* Runtime */
let appRuntime = null;

function createRuntime() {
  const runtime = {
    data: {},
    handlers: new Map(),

    setData(patch) {
      // merge new values into a new object
      runtime.data = { ...runtime.data, ...patch };
      runtime.render();
    },

    onEvent(name, fn) {
      runtime.handlers.set(name, fn);
    },

    render() {
      const tree = {
        type: "view",
        children: [
          { type: "text", value: `count = ${runtime.data.count}` },
          { type: "button", event: "inc", text: "++" },
        ],
      };
      postMessage({ type: "RENDER", tree });
    },
  };

  return runtime;
}

/* Error reporter */
function reportError(err, phase) {
  // phase: "LOAD_FAIL" | "RUN_FAIL" 
  const message = (err && err.message) ? `[${phase}] ${err.message}` : `[${phase}] ${String(err)}`;

  postMessage({
    type: "ERROR",
    message,
    stack: err && err.stack ? err.stack : "",
  });
}

/* Message handler */
onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === "EXECUTE_APP") {
    try {
      const mod = await loadModule(msg.entry, self.location.href);

      try {
        appRuntime = createRuntime();
        mod.createApp(appRuntime);
      } catch (err) {
        reportError(err, "RUN_FAIL");
      }
    } catch (err) {
      reportError(err, "LOAD_FAIL");
    }
  }

  if (msg.type === "EVENT") {
    if (!appRuntime) return;

    try {
      const handler = appRuntime.handlers.get(msg.name);
      if (handler) handler(msg.payload);
    } catch (err) {
      reportError(err, "RUN_FAIL");
    }
  }
};