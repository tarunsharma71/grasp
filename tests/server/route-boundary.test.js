import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentBoundary } from '../../src/server/route-boundary.js';

test('buildAgentBoundary infers public_read from route mode', () => {
  const boundary = buildAgentBoundary({
    status: 'direct',
    route: { selected_mode: 'public_read' },
    continuation: { suggested_next_action: 'extract' },
  });

  assert.equal(boundary.key, 'public_read');
  assert.equal(boundary.next_step, 'extract');
  assert.match(boundary.summary, /read\/extract/i);
});

test('buildAgentBoundary infers live_session from route mode', () => {
  const boundary = buildAgentBoundary({
    status: 'direct',
    route: { selected_mode: 'live_session' },
    continuation: { suggested_next_action: 'inspect' },
  });

  assert.equal(boundary.key, 'live_session');
  assert.equal(boundary.next_step, 'inspect');
});

test('buildAgentBoundary infers session_warmup from warmup status', () => {
  const boundary = buildAgentBoundary({
    status: 'warmup',
    continuation: { suggested_next_action: 'preheat_session' },
  });

  assert.equal(boundary.key, 'session_warmup');
  assert.equal(boundary.next_step, 'preheat_session');
});

test('buildAgentBoundary infers form_runtime from task kind', () => {
  const boundary = buildAgentBoundary({
    status: 'direct',
    result: { task_kind: 'form' },
    continuation: { suggested_next_action: 'verify_form' },
  });

  assert.equal(boundary.key, 'form_runtime');
  assert.equal(boundary.confirmation, 'safe_submit(mode="confirm", confirmation="SUBMIT")');
});

test('buildAgentBoundary infers workspace_runtime from task kind', () => {
  const boundary = buildAgentBoundary({
    status: 'direct',
    result: { task_kind: 'workspace' },
    continuation: { suggested_next_action: 'draft_action' },
  });

  assert.equal(boundary.key, 'workspace_runtime');
  assert.equal(boundary.confirmation, 'execute_action(mode="confirm", confirmation="EXECUTE")');
});

test('buildAgentBoundary infers handoff from gated flow', () => {
  const boundary = buildAgentBoundary({
    status: 'gated',
    continuation: { suggested_next_action: 'request_handoff' },
  });

  assert.equal(boundary.key, 'handoff');
  assert.equal(boundary.next_step, 'request_handoff');
  assert.match(boundary.summary, /handoff/i);
});

test('buildAgentBoundary falls back to page role when route metadata is absent', () => {
  const boundary = buildAgentBoundary({
    status: 'direct',
    page: { page_role: 'content' },
  });

  assert.equal(boundary.key, 'public_read');
  assert.equal(boundary.next_step, 'inspect');
});
