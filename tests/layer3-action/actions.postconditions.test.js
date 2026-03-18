import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTypeResult } from '../../src/server/postconditions.js';
import { ACTION_NOT_VERIFIED } from '../../src/server/error-codes.js';
import { createFakePage } from '../helpers/fake-page.js';

test('verifyTypeResult fails when value is not written', async () => {
  const page = createFakePage({
    evaluate: async () => ({ value: '', tag: '', isFormField: false }),
  });

  const evidence = await verifyTypeResult({ page, expectedText: 'pi agent 是啥' });

  assert.strictEqual(evidence.ok, false);
  assert.strictEqual(evidence.error_code, ACTION_NOT_VERIFIED);
  assert.strictEqual(evidence.retryable, true);
  assert.strictEqual(evidence.suggested_next_step, 'reverify');
  assert.deepStrictEqual(evidence.evidence, { value: '', tag: '', isFormField: false });
});

test('verifyTypeResult succeeds when expected text is present', async () => {
  const page = createFakePage({
    evaluate: async () => ({ value: 'pi agent 是啥', tag: 'input', isFormField: true }),
  });

  const result = await verifyTypeResult({ page, expectedText: 'pi agent 是啥' });

  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.evidence, { value: 'pi agent 是啥', tag: 'input', isFormField: true });
});
