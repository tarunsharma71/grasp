import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldMarkResumeVerified } from '../../src/server/tools.handoff.js';
import { registerHandoffTools } from '../../src/server/tools.handoff.js';

test('resume should verify when continuation is ready even if reacquired is false', () => {
  const result = shouldMarkResumeVerified({
    verify: true,
    checkpointStillPresent: false,
    pageState: {
      reacquired: false,
    },
    continuation: {
      task_continuation_ok: true,
      continuation_ready: true,
    },
  });

  assert.equal(result, true);
});

test('resume should stay unverified when continuation explicitly failed', () => {
  const result = shouldMarkResumeVerified({
    verify: true,
    checkpointStillPresent: false,
    pageState: {
      reacquired: true,
    },
    continuation: {
      task_continuation_ok: false,
      continuation_ready: false,
    },
  });

  assert.equal(result, false);
});

test('resume should stay unverified without reacquisition or continuation readiness', () => {
  const result = shouldMarkResumeVerified({
    verify: true,
    checkpointStillPresent: false,
    pageState: {
      reacquired: false,
    },
    continuation: {
      task_continuation_ok: null,
      continuation_ready: false,
    },
  });

  assert.equal(result, false);
});

test('resume_after_handoff passes state into the active page lookup', async () => {
  const calls = [];
  const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
  const state = {
    activeTaskId: 'task-a',
    pageState: {},
    handoff: { state: 'awaiting_reacquisition' },
  };
  let receivedArgs = null;

  registerHandoffTools(server, state, {
    getActivePage: async (args) => {
      receivedArgs = args;
      throw new Error('stop after lookup');
    },
  });

  const resume = calls.find((tool) => tool.name === 'resume_after_handoff');
  await assert.rejects(() => resume.handler());

  assert.equal(receivedArgs.state, state);
});
