export function createFakePage(overrides = {}) {
  const defaults = {
    url: () => 'about:blank',
    goto: async () => undefined,
    evaluate: async (fn, ...args) => fn(...args),
    screenshot: async () => Buffer.from(''),
    close: async () => undefined,
    waitForSelector: async () => null,
  };

  return {
    ...defaults,
    ...overrides,
  };
}
