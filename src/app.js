// src/app.js

export function createApp(runtime) {
  const template = `
  <view class="root">
    <text>count = {{count}}</text>
    <button class="btn" bindtap="inc">++</button>
  </view>
  `.trim();

  runtime.setTemplate(template);

  runtime.setData({ count: 0 });

  runtime.onEvent("inc", () => {
    const cur = runtime.data.count;
    runtime.setData({ count: cur + 1 });
  });
}