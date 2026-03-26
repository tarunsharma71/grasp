import test from 'node:test';
import assert from 'node:assert/strict';

import { createFakePage } from '../helpers/fake-page.js';
import { createEntryOrchestrator } from '../../src/server/entry-orchestrator.js';
import { enterWithStrategy } from '../../src/server/tools.strategy.js';

test('entry orchestrator stops after verified direct_goto success', async () => {
  const calls = [];
  const page = createFakePage({
    url: () => 'https://example.com/app',
    title: async () => 'Example App',
    evaluate: async () => true,
  });

  const orchestrator = createEntryOrchestrator({
    directGoto: async (targetUrl) => {
      calls.push(['direct_goto', targetUrl]);
      return page;
    },
    trustedContextOpen: async (targetUrl) => {
      calls.push(['trusted_context_open', targetUrl]);
      return page;
    },
  });

  const result = await orchestrator.run({
    targetUrl: 'https://example.com/app',
    strategies: ['direct_goto', 'trusted_context_open'],
  });

  assert.equal(result.entry_method, 'direct_goto');
  assert.equal(result.verified, true);
  assert.equal(result.final_url, 'https://example.com/app');
  assert.equal(result.page, page);
  assert.deepEqual(calls, [['direct_goto', 'https://example.com/app']]);
  assert.deepEqual(result.evidence.attempts.map((attempt) => attempt.strategy), ['direct_goto']);
});

test('entry orchestrator falls back to trusted_context_open after an unverified direct_goto', async () => {
  const calls = [];
  const wrongPage = createFakePage({
    url: () => 'https://example.com/login',
    title: async () => 'Login',
    evaluate: async () => true,
  });
  const trustedPage = createFakePage({
    url: () => 'https://example.com/app',
    title: async () => 'Example App',
    evaluate: async () => true,
  });

  const orchestrator = createEntryOrchestrator({
    directGoto: async (targetUrl) => {
      calls.push(['direct_goto', targetUrl]);
      return wrongPage;
    },
    trustedContextOpen: async (targetUrl) => {
      calls.push(['trusted_context_open', targetUrl]);
      return trustedPage;
    },
  });

  const result = await orchestrator.run({
    targetUrl: 'https://example.com/app',
    strategies: ['direct_goto', 'trusted_context_open'],
  });

  assert.equal(result.entry_method, 'trusted_context_open');
  assert.equal(result.verified, true);
  assert.equal(result.final_url, 'https://example.com/app');
  assert.equal(result.page, trustedPage);
  assert.deepEqual(calls, [
    ['direct_goto', 'https://example.com/app'],
    ['trusted_context_open', 'https://example.com/app'],
  ]);
  assert.deepEqual(
    result.evidence.attempts.map((attempt) => ({
      strategy: attempt.strategy,
      verified: attempt.verified,
      final_url: attempt.final_url,
    })),
    [
      { strategy: 'direct_goto', verified: false, final_url: 'https://example.com/login' },
      { strategy: 'trusted_context_open', verified: true, final_url: 'https://example.com/app' },
    ]
  );
});

test('entry orchestrator verifies by final URL even when evaluate is unavailable', async () => {
  const page = createFakePage({
    url: () => 'https://example.com/app',
    title: async () => 'Example App',
    evaluate: async () => {
      throw new Error('Execution context was destroyed');
    },
  });

  const orchestrator = createEntryOrchestrator({
    directGoto: async () => page,
    trustedContextOpen: async () => {
      throw new Error('trusted_context_open should not run');
    },
  });

  const result = await orchestrator.run({
    targetUrl: 'https://example.com/app',
    strategies: ['direct_goto', 'trusted_context_open'],
  });

  assert.equal(result.entry_method, 'direct_goto');
  assert.equal(result.verified, true);
  assert.equal(result.final_url, 'https://example.com/app');
  assert.deepEqual(result.evidence.attempts, [
    {
      strategy: 'direct_goto',
      final_url: 'https://example.com/app',
      page_available: false,
      verified: true,
    },
  ]);
});

test('enterWithStrategy preserves the public shape and uses trusted_context_open when direct entry is unsafe', async () => {
  const state = {
    pageState: {
      currentRole: 'content',
      graspConfidence: 'medium',
      riskGateDetected: false,
      lastUrl: 'https://github.com/home',
    },
  };
  const page = createFakePage({
    url: () => 'https://github.com/app',
    title: async () => 'GitHub App',
    evaluate: async () => true,
  });
  const attempted = [];

  const result = await enterWithStrategy({
    url: 'https://github.com/app',
    state,
    deps: {
      getActivePage: async () => page,
      syncPageState: async (_page, currentState) => {
        currentState.pageState = {
          ...currentState.pageState,
          currentRole: 'content',
          riskGateDetected: false,
          lastUrl: 'https://github.com/app',
        };
      },
      readHandoffState: async () => ({
        expected_url_contains: 'github.com',
      }),
      directGoto: async () => {
        attempted.push('direct_goto');
        return createFakePage({
          url: () => 'https://github.com/login',
          title: async () => 'Login',
          evaluate: async () => true,
        });
      },
      trustedContextOpen: async () => {
        attempted.push('trusted_context_open');
        return page;
      },
      audit: async () => {},
    },
  });

  assert.equal(result.url, 'https://github.com/app');
  assert.equal(result.title, 'GitHub App');
  assert.equal(result.preflight.recommended_entry_strategy, 'resume_existing_session');
  assert.equal(result.entry_method, 'trusted_context_open');
  assert.equal(result.final_url, 'https://github.com/app');
  assert.equal(result.verified, true);
  assert.deepEqual(attempted, ['trusted_context_open']);
});

test('enterWithStrategy pins the resolved page after a successful entry', async () => {
  const taskFrame = {};
  const state = {
    activeTaskId: 'task-a',
    taskFrames: new Map([['task-a', taskFrame]]),
    pageState: {
      currentRole: 'content',
      graspConfidence: 'high',
      riskGateDetected: false,
      lastUrl: 'https://example.com/home',
    },
  };
  const page = createFakePage({
    url: () => 'https://example.com/app',
    title: async () => 'Example App',
    evaluate: async () => true,
  });

  await enterWithStrategy({
    url: 'https://example.com/app',
    state,
    deps: {
      getActivePage: async () => page,
      syncPageState: async () => {},
      readHandoffState: async () => ({}),
      directGoto: async () => page,
      audit: async () => {},
    },
  });

  assert.equal(taskFrame.pinnedTarget.page, page);
  assert.equal(taskFrame.pinnedTarget.url, 'https://example.com/app');
  assert.equal(taskFrame.pinnedTarget.title, 'Example App');
  assert.equal(state.targetSession, null);
});

test('enterWithStrategy passes state through to preflight page lookup and direct_goto', async () => {
  const state = {
    activeTaskId: 'task-a',
    pageState: {
      currentRole: 'content',
      graspConfidence: 'high',
      riskGateDetected: false,
      lastUrl: 'https://example.com/home',
    },
  };
  const page = createFakePage({
    url: () => 'https://example.com/app',
    title: async () => 'Example App',
    evaluate: async () => true,
  });
  let preflightState = null;
  let directGotoState = null;

  const result = await enterWithStrategy({
    url: 'https://example.com/app',
    state,
    deps: {
      getActivePage: async (options) => {
        preflightState = options.state;
        return page;
      },
      syncPageState: async () => {},
      readHandoffState: async () => ({}),
      directGoto: async (_targetUrl, options) => {
        directGotoState = options.state;
        return page;
      },
      audit: async () => {},
    },
  });

  assert.equal(preflightState, state);
  assert.equal(directGotoState, state);
  assert.equal(result.entry_method, 'direct_goto');
  assert.equal(result.final_url, 'https://example.com/app');
});

test('entry orchestrator does not mix the last strategy with an earlier page after a later failure', async () => {
  const firstPage = createFakePage({
    url: () => 'https://example.com/first',
    title: async () => 'First',
    evaluate: async () => true,
  });

  const orchestrator = createEntryOrchestrator({
    directGoto: async () => firstPage,
    trustedContextOpen: async () => {
      throw new Error('trusted_context_open failed');
    },
  });

  const result = await orchestrator.run({
    targetUrl: 'https://example.com/app',
    strategies: ['direct_goto', 'trusted_context_open'],
  });

  assert.equal(result.entry_method, 'trusted_context_open');
  assert.equal(result.page, null);
  assert.equal(result.final_url, null);
  assert.equal(result.verified, false);
  assert.deepEqual(result.evidence.attempts, [
    {
      strategy: 'direct_goto',
      final_url: 'https://example.com/first',
      page_available: true,
      verified: false,
    },
    {
      strategy: 'trusted_context_open',
      final_url: null,
      page_available: false,
      verified: false,
      error: 'trusted_context_open failed',
    },
  ]);
});
