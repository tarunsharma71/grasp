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
