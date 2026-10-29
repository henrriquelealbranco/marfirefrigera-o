const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, callback) {
    this.listeners.set(name, [...(this.listeners.get(name) || []), callback]);
  }
  emit(name) { for (const callback of this.listeners.get(name) || []) callback(); }
}

function setup({ blocked = false, reducedMotion = false } = {}) {
  const video = Object.assign(new Events(), {
    paused: true, calls: 0, muted: false, defaultMuted: false, playsInline: false,
    classList: { add() {} },
    pause() { this.paused = true; },
    play() {
      this.calls++;
      if (blocked) return Promise.reject(Object.assign(new Error('Autoplay blocked'), { name: 'NotAllowedError' }));
      this.paused = false;
      this.emit('playing');
      return Promise.resolve();
    }
  });
  const button = Object.assign(new Events(), { hidden: true });
  const document = Object.assign(new Events(), {
    hidden: false,
    querySelector(selector) { return selector === '.hero-bg-video' ? video : button; }
  });
  const window = Object.assign(new Events(), { matchMedia: () => ({ matches: reducedMotion }) });
  vm.runInNewContext(readFileSync(resolve(__dirname, '../assets/js/hero-video.js'), 'utf8'), { document, window });
  return { video, button, document, window, allowPlayback() { blocked = false; } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('starts the background video muted and inline on entry', async () => {
  const { video, button } = setup(); await flush();
  assert.equal(video.calls, 1); assert.equal(video.paused, false);
  assert.equal(video.muted, true); assert.equal(video.defaultMuted, true);
  assert.equal(video.playsInline, true); assert.equal(button.hidden, true);
});

test('a denied autoplay exposes a usable play button and recovers on a tap', async () => {
  const app = setup({ blocked: true }); await flush();
  assert.equal(app.button.hidden, false); assert.equal(app.video.paused, true);
  app.allowPlayback(); app.button.emit('click'); await flush();
  assert.equal(app.video.paused, false); assert.equal(app.button.hidden, true);
});

test('the first page interaction can recover a blocked autoplay', async () => {
  const app = setup({ blocked: true }); await flush();
  app.allowPlayback(); app.document.emit('touchstart'); await flush();
  assert.equal(app.video.paused, false); assert.equal(app.button.hidden, true);
});

test('reduced motion requires an explicit press of the play button', async () => {
  const app = setup({ reducedMotion: true }); await flush();
  app.document.emit('pointerdown'); await flush();
  assert.equal(app.video.calls, 0); assert.equal(app.button.hidden, false);
  app.button.emit('click'); await flush(); assert.equal(app.video.paused, false);
});

test('returning to a visible page retries a paused video', async () => {
  const app = setup(); await flush(); app.video.paused = true;
  app.document.hidden = true; app.document.emit('visibilitychange'); await flush();
  assert.equal(app.video.calls, 1);
  app.document.hidden = false; app.document.emit('visibilitychange'); await flush();
  assert.equal(app.video.calls, 2); assert.equal(app.video.paused, false);
});
