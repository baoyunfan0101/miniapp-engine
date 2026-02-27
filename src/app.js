// src/app.js
export function createApp(runtime) {
  runtime.setData({ count: 0 });

  runtime.onEvent("inc", () => {
    const cur = runtime.data.count;
    runtime.setData({ count: cur + 1 });
  });

  runtime.render();
}