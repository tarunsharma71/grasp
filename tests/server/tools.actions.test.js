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
