import { ACTION_NOT_VERIFIED } from './error-codes.js';

export async function verifyTypeResult({ page, expectedText }) {
  const evidence = await page.evaluate(() => {
    const active = document.activeElement;
    const tag = active?.tagName?.toLowerCase() ?? '';
    const value = active?.value ?? '';
    const isFormField = ['input', 'textarea'].includes(tag) || active?.isContentEditable;
    return { value, tag, isFormField };
  });

  if (evidence.value === expectedText && evidence.isFormField) {
    return { ok: true, evidence };
  }

  return {
    ok: false,
    error_code: ACTION_NOT_VERIFIED,
    retryable: true,
    suggested_next_step: 'reverify',
    evidence,
  };
}
