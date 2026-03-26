import test from 'node:test';
import assert from 'node:assert/strict';

import { registerStrategyTools } from '../../src/server/tools.strategy.js';

test('session_trust_preflight passes state into the active page lookup', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = {
    activeTaskId: 'task-a',
    pageState: { currentRole: 'content', graspConfidence: 'high', riskGateDetected: false },
    handoff: { state: 'idle' },
  };
  let receivedArgs = null;

  registerStrategyTools(server, state, {
    getActivePage: async (args) => {
      receivedArgs = args;
      throw new Error('stop after lookup');
    },
  });

  const tool = calls.find((entry) => entry.name === 'session_trust_preflight');
  await tool.handler({ url: 'https://example.com' });

  assert.equal(receivedArgs.state, state);
});

test('suggest_handoff passes state into the active page lookup', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = {
    activeTaskId: 'task-a',
    pageState: { currentRole: 'checkpoint', graspConfidence: 'low', riskGateDetected: true },
    handoff: { state: 'handoff_required' },
  };
  let receivedArgs = null;

  registerStrategyTools(server, state, {
    getActivePage: async (args) => {
      receivedArgs = args;
      throw new Error('stop after lookup');
    },
  });

  const tool = calls.find((entry) => entry.name === 'suggest_handoff');
  await assert.rejects(() => tool.handler());

  assert.equal(receivedArgs.state, state);
});

test('request_handoff_from_checkpoint passes state into the active page lookup', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = {
    activeTaskId: 'task-a',
    pageState: { currentRole: 'checkpoint', graspConfidence: 'low', riskGateDetected: true },
    handoff: { state: 'handoff_required' },
  };
  let receivedArgs = null;

  registerStrategyTools(server, state, {
    getActivePage: async (args) => {
      receivedArgs = args;
      throw new Error('stop after lookup');
    },
  });

  const tool = calls.find((entry) => entry.name === 'request_handoff_from_checkpoint');
  await assert.rejects(() => tool.handler({}));

  assert.equal(receivedArgs.state, state);
});
