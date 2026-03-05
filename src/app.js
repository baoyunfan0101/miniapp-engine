// src/app.js

export function createApp(runtime) {
  const template = `
  <view class="root">
    <text tt:if="{{count % 3 === 0}}">count = {{count}} is divisible by 3</text>
    <text tt:elif="{{count % 3 === 1}}">count = {{count}} gives remainder 1 when divided by 3</text>
    <text tt:else>count = {{count}} gives remainder 2 when divided by 3</text>
    <button class="btn" bindtap="inc">++</button>
  </view>
  `.trim();

  runtime.setTemplate(template);

  runtime.setData({ count: 0});

  runtime.onEvent("inc", () => {
    const cur = runtime.data.count;
    runtime.setData({ count: cur + 1 });
  });
}