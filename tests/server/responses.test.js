import test from 'node:test';
import assert from 'node:assert/strict';
import { textResponse, errorResponse } from '../../src/server/responses.js';

const retryMeta = {
  retry: {
    attempt: 2,
    maxAttempts: 5,
  },
};

const traceMeta = {
  traceId: 'trace-123',
};

const actionMeta = {
  error_code: 'ACTION_NOT_VERIFIED',
  retryable: true,
  suggested_next_step: 'reverify',
  evidence: {
    phase: 'verify',
  },
};

test('errorResponse passes retry metadata through', () => {
  const response = errorResponse('ouch', retryMeta);

  assert.strictEqual(response.isError, true);
  assert.deepStrictEqual(response.meta, retryMeta);
  assert.strictEqual(response.content[0].text, 'ouch');
});

test('textResponse forwards metadata when provided', () => {
  const response = textResponse('hello world', traceMeta);

  assert.deepStrictEqual(response.meta, traceMeta);
  assert.strictEqual(response.content[0].text, 'hello world');
});

test('errorResponse surfaces action verification meta shape', () => {
  const result = errorResponse('boom', actionMeta);

  assert.strictEqual(result.isError, true);
  assert.strictEqual(result.meta.error_code, 'ACTION_NOT_VERIFIED');
  assert.strictEqual(result.meta.retryable, true);
  assert.strictEqual(result.meta.suggested_next_step, 'reverify');
  assert.deepStrictEqual(result.meta.evidence, { phase: 'verify' });
});
