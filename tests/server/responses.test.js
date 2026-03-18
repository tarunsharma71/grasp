import test from 'node:test';
import assert from 'node:assert/strict';
import { textResponse, errorResponse } from '../../src/server/responses.js';

const retryMetadata = {
  retry: {
    attempt: 2,
    maxAttempts: 5,
  },
};

const traceMetadata = {
  traceId: 'trace-123',
};

test('errorResponse passes retry metadata through', () => {
  const response = errorResponse('ouch', retryMetadata);

  assert.strictEqual(response.isError, true);
  assert.deepStrictEqual(response.metadata, retryMetadata);
  assert.strictEqual(response.content[0].text, 'ouch');
});

test('textResponse forwards metadata when provided', () => {
  const response = textResponse('hello world', traceMetadata);

  assert.deepStrictEqual(response.metadata, traceMetadata);
  assert.strictEqual(response.content[0].text, 'hello world');
});
