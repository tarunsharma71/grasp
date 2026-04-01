import test from 'node:test';
import assert from 'node:assert/strict';

import { createFakePage } from '../helpers/fake-page.js';
import { registerActionTools } from '../../src/server/tools.actions.js';

function createBossPage({ url, title, selectors }) {
  return createFakePage({
    url: () => url,
    title: () => title,
    evaluate: async (fn, ...args) => {
      const saved = new Map();
      saved.set('document', globalThis.document);
      globalThis.document = {
        querySelector: (selector) => selectors[selector] ?? null,
      };

      try {
        return await fn(...args);
      } finally {
        globalThis.document = saved.get('document');
      }
    },
  });
}

test('get_page_summary uses fast path on BOSS pages and skips heavy read dependencies', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = { pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false }, handoff: { state: 'idle' } };
  let receivedPageArg = null;
  let syncCalls = 0;
  const page = createBossPage({
    url: 'https://www.zhipin.com/job_detail/123.html',
    title: '算法工程师 - BOSS直聘',
    selectors: {
      '[data-url*="/wapi/zpgeek/friend/add.json"]': { innerText: '立即沟通', textContent: '立即沟通', getAttribute: (name) => (name === 'data-url' ? '/wapi/zpgeek/friend/add.json' : name === 'redirect-url' ? '/chat/abc' : null) },
    },
  });

  registerActionTools(server, state, {
    getActivePage: async (args) => {
      receivedPageArg = args;
      return page;
    },
    syncPageState: async (_page, currentState, options) => {
      syncCalls += 1;
      currentState.pageState = state.pageState;
      assert.deepEqual(options, { force: true });
      return currentState;
    },
    extractMainContent: async () => {
      throw new Error('extractMainContent should not run on fast path');
    },
  });

  const summary = calls.find((tool) => tool.name === 'get_page_summary');
  const result = await summary.handler();

  assert.equal(receivedPageArg.state, state);
  assert.equal(syncCalls, 1);
  assert.match(result.content[0].text, /Title: 算法工程师 - BOSS直聘/);
  assert.match(result.content[0].text, /URL: https:\/\/www\.zhipin\.com\/job_detail\/123\.html/);
  assert.match(result.content[0].text, /Mode: CDP \(Hint Map \+ Mouse Events\)/);
  assert.match(result.content[0].text, /立即沟通/);
  assert.deepEqual(result.meta.result, {
    engine: 'runtime',
    surface: 'detail',
    title: '算法工程师 - BOSS直聘',
    url: 'https://www.zhipin.com/job_detail/123.html',
    summary: '立即沟通 /chat/abc',
    main_text: '立即沟通\n/chat/abc',
  });
});

test('get_status passes state into the active page lookup', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const page = createFakePage({
    url: () => 'https://example.com',
    title: () => 'Example',
  });
  const state = {
    activeTaskId: 'task-a',
    pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false },
    handoff: { state: 'idle' },
  };
  let receivedArgs = null;

  registerActionTools(server, state, {
    getActivePage: async (args) => {
      receivedArgs = args;
      return page;
    },
    syncPageState: async (_page, currentState) => {
      currentState.pageState = state.pageState;
      return currentState;
    },
  });

  const status = calls.find((tool) => tool.name === 'get_status');
  await status.handler();

  assert.equal(receivedArgs.state, state);
});

test('get_status reports headless instance identity explicitly', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const page = createFakePage({
    url: () => 'https://example.com',
    title: () => 'Example',
  });
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false },
    handoff: { state: 'idle' },
  };

  registerActionTools(server, state, {
    getActivePage: async () => page,
    syncPageState: async (_page, currentState) => {
      currentState.pageState = state.pageState;
      return currentState;
    },
    getBrowserInstance: async () => ({
      browser: 'HeadlessChrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: true,
      display: 'headless',
      warning: 'Current endpoint is a headless browser, not a visible local browser window.',
    }),
  });

  const status = calls.find((tool) => tool.name === 'get_status');
  const result = await status.handler();
  const text = result.content[0].text;

  assert.match(text, /Browser instance: HeadlessChrome\/136\.0\.7103\.114/);
  assert.match(text, /Instance mode: headless/);
  assert.match(text, /Instance warning: Current endpoint is a headless browser, not a visible local browser window\./);
  assert.deepEqual(result.meta.instance, {
    browser: 'HeadlessChrome/136.0.7103.114',
    protocolVersion: '1.3',
    headless: true,
    display: 'headless',
    warning: 'Current endpoint is a headless browser, not a visible local browser window.',
  });
});

test('scroll targets the nearest scrollable container and reports position metadata', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high', domRevision: 7 },
    handoff: { state: 'idle' },
    runtimeConfirmation: {
      instance_key: 'windowed|Chrome/136.0.7103.114|1.3',
      display: 'windowed',
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      confirmed_at: 0,
    },
  };
  const documentElement = { scrollTop: 0, scrollHeight: 2400, clientHeight: 900 };
  const container = {
    id: 'scroll-container',
    tagName: 'DIV',
    contentEditable: 'false',
    scrollTop: 0,
    scrollHeight: 1200,
    clientHeight: 250,
    scrollWidth: 400,
    clientWidth: 400,
    classList: [],
    getAttribute: () => null,
    scrollBy: (_dx, dy) => {
      container.scrollTop += dy;
    },
    parentElement: documentElement,
  };
  const target = {
    tagName: 'BUTTON',
    contentEditable: 'false',
    scrollHeight: 20,
    clientHeight: 20,
    scrollWidth: 20,
    clientWidth: 20,
    classList: [],
    getAttribute: (name) => (name === 'data-grasp-id' ? 'B7' : null),
    parentElement: container,
  };
  const page = createFakePage({
    evaluate: async (fn, ...args) => {
      const originalDocument = global.document;
      const originalWindow = global.window;
      const originalCss = global.CSS;
      const originalRequestAnimationFrame = global.requestAnimationFrame;

      global.document = {
        documentElement,
        querySelector: (selector) => {
          if (selector === '[data-grasp-id="B7"]') return target;
          if (selector === '#scroll-container') return container;
          return null;
        },
      };
      global.window = {
        document: global.document,
        getComputedStyle: (element) => {
          if (element === container) {
            return { overflowY: 'auto', overflowX: 'hidden' };
          }
          return { overflowY: 'visible', overflowX: 'visible' };
        },
      };
      global.CSS = { escape: (value) => String(value) };
      global.requestAnimationFrame = (callback) => callback();

      try {
        return await fn(...args);
      } finally {
        global.document = originalDocument;
        global.window = originalWindow;
        global.CSS = originalCss;
        global.requestAnimationFrame = originalRequestAnimationFrame;
      }
    },
  });
  let syncCalls = 0;

  registerActionTools(server, state, {
    getActivePage: async () => page,
    syncPageState: async (_page, currentState) => {
      syncCalls += 1;
      currentState.pageState = {
        currentRole: 'content',
        graspConfidence: 'high',
        domRevision: 8,
      };
      return currentState;
    },
    getBrowserInstance: async () => ({
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: false,
      display: 'windowed',
      warning: null,
    }),
  });

  const tool = calls.find((entry) => entry.name === 'scroll');
  const result = await tool.handler({ direction: 'down', amount: 150, hint_id: 'B7' });

  assert.equal(syncCalls, 2);
  assert.match(result.content[0].text, /container #scroll-container/);
  assert.equal(result.meta.target, '#scroll-container');
  assert.equal(result.meta.scrollTop, 150);
  assert.equal(result.meta.atTop, false);
  assert.equal(result.meta.dom_revision, 8);
});

test('scroll reports horizontal metadata when scrolling a container sideways', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high', domRevision: 2 },
    handoff: { state: 'idle' },
    runtimeConfirmation: {
      instance_key: 'windowed|Chrome/136.0.7103.114|1.3',
      display: 'windowed',
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      confirmed_at: 0,
    },
  };
  const documentElement = { scrollTop: 0, scrollHeight: 100, clientHeight: 100, scrollLeft: 0, scrollWidth: 100, clientWidth: 100 };
  const container = {
    id: 'scroll-container',
    tagName: 'DIV',
    contentEditable: 'false',
    scrollTop: 0,
    scrollHeight: 100,
    clientHeight: 100,
    scrollLeft: 0,
    scrollWidth: 900,
    clientWidth: 300,
    classList: [],
    getAttribute: () => null,
    scrollBy: (dx, _dy) => {
      container.scrollLeft += dx;
    },
    parentElement: documentElement,
  };
  const target = {
    tagName: 'BUTTON',
    contentEditable: 'false',
    scrollHeight: 20,
    clientHeight: 20,
    scrollWidth: 20,
    clientWidth: 20,
    classList: [],
    getAttribute: (name) => (name === 'data-grasp-id' ? 'B9' : null),
    parentElement: container,
  };
  const page = createFakePage({
    evaluate: async (fn, ...args) => {
      const originalDocument = global.document;
      const originalWindow = global.window;
      const originalCss = global.CSS;
      const originalRequestAnimationFrame = global.requestAnimationFrame;

      global.document = {
        documentElement,
        querySelector: (selector) => {
          if (selector === '[data-grasp-id="B9"]') return target;
          if (selector === '#scroll-container') return container;
          return null;
        },
      };
      global.window = {
        document: global.document,
        getComputedStyle: (element) => {
          if (element === container) {
            return { overflowY: 'hidden', overflowX: 'auto' };
          }
          return { overflowY: 'visible', overflowX: 'visible' };
        },
      };
      global.CSS = { escape: (value) => String(value) };
      global.requestAnimationFrame = (callback) => callback();

      try {
        return await fn(...args);
      } finally {
        global.document = originalDocument;
        global.window = originalWindow;
        global.CSS = originalCss;
        global.requestAnimationFrame = originalRequestAnimationFrame;
      }
    },
  });

  registerActionTools(server, state, {
    getActivePage: async () => page,
    syncPageState: async (_page, currentState) => {
      currentState.pageState = state.pageState;
      return currentState;
    },
    getBrowserInstance: async () => ({
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: false,
      display: 'windowed',
      warning: null,
    }),
  });

  const tool = calls.find((entry) => entry.name === 'scroll');
  const result = await tool.handler({ direction: 'right', amount: 120, hint_id: 'B9' });

  assert.equal(result.meta.target, '#scroll-container');
  assert.equal(result.meta.scrollLeft, 120);
  assert.equal(result.meta.scrollWidth, 900);
  assert.equal(result.meta.clientWidth, 300);
  assert.equal(result.meta.atLeft, false);
  assert.equal(result.meta.atRight, false);
});

test('scroll_into_view scrolls a hinted element and reports movement metadata', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high', domRevision: 2 },
    handoff: { state: 'idle' },
    runtimeConfirmation: {
      instance_key: 'windowed|Chrome/136.0.7103.114|1.3',
      display: 'windowed',
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      confirmed_at: 0,
    },
  };
  const syncOptions = [];
  let evaluateCalls = 0;
  const page = createFakePage({
    evaluate: async (_fn, args) => {
      evaluateCalls += 1;
      if (args?.sel) {
        assert.equal(args.sel, '[data-grasp-id="B12"]');
        assert.equal(args.pos, 'end');
        return {
          ok: true,
          tag: 'button',
          label: '继续',
          moved: true,
          rect: { top: 88, left: 12, width: 120, height: 32 },
        };
      }
      return undefined;
    },
  });

  registerActionTools(server, state, {
    getActivePage: async () => page,
    syncPageState: async (_page, currentState, options) => {
      syncOptions.push(options);
      currentState.pageState = {
        currentRole: 'content',
        graspConfidence: 'high',
        domRevision: 3,
      };
      return currentState;
    },
    getBrowserInstance: async () => ({
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: false,
      display: 'windowed',
      warning: null,
    }),
  });

  const tool = calls.find((entry) => entry.name === 'scroll_into_view');
  const result = await tool.handler({ hint_id: 'B12', position: 'end' });

  assert.equal(evaluateCalls, 2);
  assert.deepEqual(syncOptions, [{ force: true }, { force: true }]);
  assert.match(result.content[0].text, /Scrolled to \[B12\] \(button: "继续"\)/);
  assert.equal(result.meta.hint_id, 'B12');
  assert.equal(result.meta.position, 'end');
  assert.equal(result.meta.moved, true);
  assert.deepEqual(result.meta.rect, { top: 88, left: 12, width: 120, height: 32 });
});

test('scroll_into_view returns a not found error when the hint is missing', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high' },
    handoff: { state: 'idle' },
    runtimeConfirmation: {
      instance_key: 'windowed|Chrome/136.0.7103.114|1.3',
      display: 'windowed',
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      confirmed_at: 0,
    },
  };
  let syncCalls = 0;
  const page = createFakePage({
    evaluate: async (_fn, args) => {
      if (args?.sel) {
        return { ok: false, reason: 'not_found' };
      }
      return undefined;
    },
  });

  registerActionTools(server, state, {
    getActivePage: async () => page,
    syncPageState: async (_page, currentState, options) => {
      syncCalls += 1;
      assert.deepEqual(options, { force: true });
      currentState.pageState = state.pageState;
      return currentState;
    },
    getBrowserInstance: async () => ({
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: false,
      display: 'windowed',
      warning: null,
    }),
  });

  const tool = calls.find((entry) => entry.name === 'scroll_into_view');
  const result = await tool.handler({ hint_id: 'B404' });

  assert.equal(syncCalls, 1);
  assert.match(result.content[0].text, /Element \[B404\] not found\. Call get_hint_map to refresh\./);
  assert.equal(result.isError, true);
});

test('screenshot returns base64 image content when page capture yields a Buffer', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const page = createFakePage({
    screenshot: async () => Buffer.from('png-binary'),
    waitForFunction: async () => undefined,
  });
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high' },
    handoff: { state: 'idle' },
  };

  registerActionTools(server, state, {
    getActivePage: async () => page,
  });

  const tool = calls.find((entry) => entry.name === 'screenshot');
  const result = await tool.handler();

  assert.strictEqual(result.content[0].type, 'image');
  assert.strictEqual(result.content[0].data, Buffer.from('png-binary').toString('base64'));
  assert.strictEqual(result.content[0].mimeType, 'image/png');
});

test('screenshot supports fullPage capture at action tool level', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const captureOptions = [];
  const page = createFakePage({
    screenshot: async (options) => {
      captureOptions.push(options);
      return 'base64-screenshot';
    },
    waitForFunction: async () => undefined,
  });
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high' },
    handoff: { state: 'idle' },
  };

  registerActionTools(server, state, {
    getActivePage: async () => page,
  });

  const tool = calls.find((entry) => entry.name === 'screenshot');
  const result = await tool.handler({ fullPage: true });

  assert.deepEqual(captureOptions, [{ encoding: 'base64', fullPage: true }]);
  assert.strictEqual(result.content[0].type, 'image');
  assert.strictEqual(result.content[0].data, 'base64-screenshot');
  assert.strictEqual(result.content[0].mimeType, 'image/png');
});

test('navigate is blocked until the runtime instance is explicitly confirmed', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = {
    pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false },
    handoff: { state: 'idle' },
  };

  registerActionTools(server, state, {
    navigateTo: async () => {
      throw new Error('navigateTo should not run before confirmation');
    },
    getBrowserInstance: async () => ({
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: false,
      display: 'windowed',
      warning: null,
    }),
  });

  const navigate = calls.find((tool) => tool.name === 'navigate');
  const result = await navigate.handler({ url: 'https://example.com' });

  assert.match(result.content[0].text, /Runtime instance confirmation required/);
  assert.equal(result.meta.error_code, 'INSTANCE_CONFIRMATION_REQUIRED');
  assert.equal(result.meta.suggested_next_step, 'confirm_runtime_instance');
});

test('confirm_runtime_instance unlocks actions for the same runtime instance', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false },
    handoff: { state: 'idle' },
  };
  const page = createFakePage({
    url: () => 'https://example.com',
    title: () => 'Example',
  });

  registerActionTools(server, state, {
    navigateTo: async () => page,
    syncPageState: async (_page, currentState, options) => {
      currentState.pageState = state.pageState;
      assert.deepEqual(options, { force: true });
      return currentState;
    },
    getBrowserInstance: async () => ({
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: false,
      display: 'windowed',
      warning: null,
    }),
  });

  const confirmTool = calls.find((tool) => tool.name === 'confirm_runtime_instance');
  const navigate = calls.find((tool) => tool.name === 'navigate');

  const confirmResult = await confirmTool.handler({ display: 'windowed' });
  const navigateResult = await navigate.handler({ url: 'https://example.com' });

  assert.match(confirmResult.content[0].text, /Runtime instance confirmed: windowed/);
  assert.match(navigateResult.content[0].text, /Navigated to: https:\/\/example\.com/);
});

test('go_back navigates browser history and reports changed metadata', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  let currentUrl = 'https://example.com/detail';
  const goBackOptions = [];
  let syncCalls = 0;
  const page = createFakePage({
    url: () => currentUrl,
    goBack: async (options) => {
      goBackOptions.push(options);
      currentUrl = 'https://example.com/list';
      return { ok: true };
    },
  });
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false },
    handoff: { state: 'idle' },
    runtimeConfirmation: {
      instance_key: 'windowed|Chrome/136.0.7103.114|1.3',
      display: 'windowed',
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      confirmed_at: 0,
    },
  };

  registerActionTools(server, state, {
    getActivePage: async () => page,
    syncPageState: async (_page, currentState, options) => {
      syncCalls += 1;
      assert.deepEqual(options, { force: true });
      currentState.pageState = state.pageState;
      return currentState;
    },
    getBrowserInstance: async () => ({
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: false,
      display: 'windowed',
      warning: null,
    }),
  });

  const tool = calls.find((entry) => entry.name === 'go_back');
  const result = await tool.handler();

  assert.equal(syncCalls, 1);
  assert.deepEqual(goBackOptions, [{ waitUntil: 'domcontentloaded', timeout: 10000 }]);
  assert.match(result.content[0].text, /Navigated back: https:\/\/example\.com\/list/);
  assert.equal(result.meta.url, 'https://example.com/list');
  assert.equal(result.meta.changed, true);
});

test('go_forward reports no history when no forward entry exists', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const goForwardOptions = [];
  const page = createFakePage({
    url: () => 'https://example.com/list',
    goForward: async (options) => {
      goForwardOptions.push(options);
      return null;
    },
  });
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false },
    handoff: { state: 'idle' },
    runtimeConfirmation: {
      instance_key: 'windowed|Chrome/136.0.7103.114|1.3',
      display: 'windowed',
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      confirmed_at: 0,
    },
  };

  registerActionTools(server, state, {
    getActivePage: async () => page,
    syncPageState: async (_page, currentState, options) => {
      assert.deepEqual(options, { force: true });
      currentState.pageState = state.pageState;
      return currentState;
    },
    getBrowserInstance: async () => ({
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: false,
      display: 'windowed',
      warning: null,
    }),
  });

  const tool = calls.find((entry) => entry.name === 'go_forward');
  const result = await tool.handler();

  assert.deepEqual(goForwardOptions, [{ waitUntil: 'domcontentloaded', timeout: 10000 }]);
  assert.match(result.content[0].text, /No forward page in history\./);
  assert.equal(result.meta.url, 'https://example.com/list');
  assert.equal(result.meta.changed, false);
});

test('reload refreshes the active page with domcontentloaded wait strategy', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const reloadOptions = [];
  let syncCalls = 0;
  const page = createFakePage({
    url: () => 'https://example.com/list',
    reload: async (options) => {
      reloadOptions.push(options);
    },
  });
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false },
    handoff: { state: 'idle' },
    runtimeConfirmation: {
      instance_key: 'windowed|Chrome/136.0.7103.114|1.3',
      display: 'windowed',
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      confirmed_at: 0,
    },
  };

  registerActionTools(server, state, {
    getActivePage: async () => page,
    syncPageState: async (_page, currentState, options) => {
      syncCalls += 1;
      assert.deepEqual(options, { force: true });
      currentState.pageState = state.pageState;
      return currentState;
    },
    getBrowserInstance: async () => ({
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: false,
      display: 'windowed',
      warning: null,
    }),
  });

  const tool = calls.find((entry) => entry.name === 'reload');
  const result = await tool.handler();

  assert.equal(syncCalls, 1);
  assert.deepEqual(reloadOptions, [{ waitUntil: 'domcontentloaded', timeout: 15000 }]);
  assert.match(result.content[0].text, /Reloaded: https:\/\/example\.com\/list/);
  assert.equal(result.meta.url, 'https://example.com/list');
});

test('get_page_summary uses the runtime branch for non-BOSS runtime hosts', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = { pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false }, handoff: { state: 'idle' } };
  let syncCalls = 0;
  let extractCalls = 0;
  const page = createFakePage({
    url: () => 'https://mp.weixin.qq.com/',
    title: () => '微信公众平台',
  });

  registerActionTools(server, state, {
    getActivePage: async () => page,
    syncPageState: async (_page, currentState, options) => {
      syncCalls += 1;
      currentState.pageState = state.pageState;
      assert.deepEqual(options, { force: true });
      return currentState;
    },
    extractMainContent: async () => {
      extractCalls += 1;
      return { title: '微信公众平台', text: 'Runtime summary text.' };
    },
  });

  const summary = calls.find((tool) => tool.name === 'get_page_summary');
  const result = await summary.handler();

  assert.equal(syncCalls, 1);
  assert.equal(extractCalls, 1);
  assert.match(result.content[0].text, /Title: 微信公众平台/);
  assert.deepEqual(result.meta.result, {
    engine: 'runtime',
    surface: 'content',
    title: '微信公众平台',
    url: 'https://mp.weixin.qq.com/',
    summary: 'Runtime summary text',
    main_text: 'Runtime summary text.',
  });
});

test('get_page_summary falls back to the old path on non-BOSS pages', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = { pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false }, handoff: { state: 'idle' } };
  let syncCalls = 0;
  let extractCalls = 0;
  const page = createFakePage({
    url: () => 'https://example.com',
    title: () => 'Example',
  });

  registerActionTools(server, state, {
    getActivePage: async () => page,
    syncPageState: async (_page, currentState) => {
      syncCalls += 1;
      currentState.pageState = state.pageState;
      return currentState;
    },
    extractMainContent: async () => {
      extractCalls += 1;
      return { title: 'Example', text: 'Example page text.' };
    },
  });

  const summary = calls.find((tool) => tool.name === 'get_page_summary');
  const result = await summary.handler();

  assert.equal(syncCalls, 1);
  assert.equal(extractCalls, 1);
  assert.match(result.content[0].text, /Title: Example/);
  assert.match(result.content[0].text, /Example page text\./);
  assert.deepEqual(result.meta.result, {
    engine: 'data',
    surface: 'content',
    title: 'Example',
    url: 'https://example.com',
    summary: 'Example page text',
    main_text: 'Example page text.',
  });
});

test('get_tabs returns injected tab metadata', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = { pageState: { currentRole: 'content', graspConfidence: 'high' }, handoff: { state: 'idle' } };

  registerActionTools(server, state, {
    getTabs: async () => ([
      { index: 0, title: 'Example', url: 'https://example.com', isUser: true },
      { index: 1, title: 'Docs', url: 'https://example.com/docs', isUser: true },
    ]),
  });

  const tool = calls.find((entry) => entry.name === 'get_tabs');
  const result = await tool.handler();

  assert.match(result.content[0].text, /\[0\] Example — https:\/\/example\.com/);
  assert.match(result.content[0].text, /\[1\] Docs — https:\/\/example\.com\/docs/);
  assert.equal(result.meta.tabs.length, 2);
});

test('new_tab opens a tab after runtime confirmation and syncs page state', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const page = createFakePage({
    url: () => 'https://example.com/new',
    title: () => 'New Tab',
  });
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false },
    handoff: { state: 'idle' },
    runtimeConfirmation: {
      instance_key: 'windowed|Chrome/136.0.7103.114|1.3',
      display: 'windowed',
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      confirmed_at: 0,
    },
  };
  let syncCalls = 0;

  registerActionTools(server, state, {
    newTab: async (url) => {
      assert.equal(url, 'https://example.com/new');
      return page;
    },
    syncPageState: async (_page, currentState, options) => {
      syncCalls += 1;
      assert.deepEqual(options, { force: true });
      currentState.pageState = state.pageState;
      return currentState;
    },
    getBrowserInstance: async () => ({
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: false,
      display: 'windowed',
      warning: null,
    }),
  });

  const tool = calls.find((entry) => entry.name === 'new_tab');
  const result = await tool.handler({ url: 'https://example.com/new' });

  assert.equal(syncCalls, 1);
  assert.match(result.content[0].text, /Opened new tab: https:\/\/example\.com\/new/);
  assert.equal(result.meta.url, 'https://example.com/new');
});

test('handle_dialog accepts pending dialogs and clears dialog state', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  let acceptedText = null;
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false },
    handoff: { state: 'idle' },
    runtimeConfirmation: {
      instance_key: 'windowed|Chrome/136.0.7103.114|1.3',
      display: 'windowed',
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      confirmed_at: 0,
    },
    pendingDialog: {
      type: 'prompt',
      message: 'Your name?',
      defaultValue: '',
      ref: {
        accept: async (text) => {
          acceptedText = text;
        },
        dismiss: async () => undefined,
      },
    },
  };

  registerActionTools(server, state, {
    getBrowserInstance: async () => ({
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: false,
      display: 'windowed',
      warning: null,
    }),
  });

  const tool = calls.find((entry) => entry.name === 'handle_dialog');
  const result = await tool.handler({ action: 'accept', text: 'Copilot' });

  assert.equal(acceptedText, 'Copilot');
  assert.equal(state.pendingDialog, null);
  assert.match(result.content[0].text, /Dialog accepted\. Type: prompt, Message: "Your name\?"/);
});

test('get_console_logs filters entries and clears the buffer when requested', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const page = createFakePage({
    on: () => undefined,
  });
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high' },
    handoff: { state: 'idle' },
    consoleLogs: [
      { level: 'error', text: 'boom', timestamp: 1 },
      { level: 'info', text: 'ok', timestamp: 2 },
    ],
  };

  registerActionTools(server, state, {
    getActivePage: async () => page,
  });

  const tool = calls.find((entry) => entry.name === 'get_console_logs');
  const result = await tool.handler({ level: 'error', clear: true });

  assert.match(result.content[0].text, /\[error\] boom/);
  assert.equal(result.meta.count, 1);
  assert.equal(result.meta.total, 2);
  assert.deepEqual(state.consoleLogs, []);
});

test('get_console_logs does not re-attach listeners when the same page navigates', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const attached = [];
  let currentUrl = 'https://example.com/first';
  const page = createFakePage({
    url: () => currentUrl,
    on: (eventName) => {
      attached.push(eventName);
    },
  });
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high' },
    handoff: { state: 'idle' },
    consoleLogs: [],
  };

  registerActionTools(server, state, {
    getActivePage: async () => page,
  });

  const tool = calls.find((entry) => entry.name === 'get_console_logs');
  await tool.handler({});
  currentUrl = 'https://example.com/second';
  await tool.handler({});

  assert.deepEqual(attached, ['dialog', 'console']);
});

test('wait_for uses getByText for text conditions with special characters', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const requested = [];
  const waits = [];
  const targetText = 'He said "hi"\nthere';
  const page = createFakePage({
    _guid: undefined,
    url: () => 'https://example.com',
    on: () => undefined,
    getByText: (text) => {
      requested.push(text);
      return {
        first() {
          return {
            waitFor: async (options) => {
              waits.push(options);
            },
          };
        },
      };
    },
    locator: () => {
      throw new Error('wait_for should use getByText for text waits');
    },
  });
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high' },
    handoff: { state: 'idle' },
  };

  registerActionTools(server, state, {
    getActivePage: async () => page,
  });

  const tool = calls.find((entry) => entry.name === 'wait_for');
  const result = await tool.handler({ text: targetText, timeout: 4321 });

  assert.deepEqual(requested, [targetText]);
  assert.deepEqual(waits, [{ state: 'visible', timeout: 4321 }]);
  assert.match(result.content[0].text, /appeared on the page/);
});

test('double_click must trigger double-click semantics at action-tool level', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = {
    hintMap: [],
    pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false },
    handoff: { state: 'idle' },
    runtimeConfirmation: {
      instance_key: 'windowed|Chrome/136.0.7103.114|1.3',
      display: 'windowed',
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      confirmed_at: 0,
    },
  };
  const page = createFakePage({
    evaluate: async (_fn, ...args) => {
      if (args.length === 1 && typeof args[0] === 'string') {
        return {
          inView: true,
          centerY: 200,
          tag: 'button',
          label: '提交',
        };
      }
      if (args.length === 0) {
        return { w: 1280, h: 720 };
      }
      return null;
    },
    $: async () => ({
      boundingBox: async () => ({ x: 50, y: 80, width: 120, height: 40 }),
    }),
    waitForLoadState: async () => undefined,
  });

  registerActionTools(server, state, {
    getActivePage: async () => page,
    syncPageState: async (_page, currentState) => {
      currentState.pageState = state.pageState;
      return currentState;
    },
    getBrowserInstance: async () => ({
      browser: 'Chrome/136.0.7103.114',
      protocolVersion: '1.3',
      headless: false,
      display: 'windowed',
      warning: null,
    }),
  });

  const tool = calls.find((entry) => entry.name === 'double_click');
  const result = await tool.handler({ hint_id: 'B5' });
  const downCount = page.actionsLog.filter((entry) => entry.target === 'mouse' && entry.method === 'down').length;
  const clickWithDoubleCount = page.actionsLog.some((entry) => entry.target === 'mouse' && entry.method === 'click' && entry.args[2]?.clickCount === 2);

  assert.match(result.content[0].text, /Double-clicked \[B5\]/);
  assert.ok(
    downCount >= 2 || clickWithDoubleCount,
    `expected double-click semantics, got actions: ${JSON.stringify(page.actionsLog)}`
  );
});
