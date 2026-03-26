import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPageProjection } from '../../src/server/page-projection.js';

test('buildPageProjection normalizes the shared read surface', () => {
  assert.deepEqual(
    buildPageProjection({
      engine: 'runtime',
      surface: 'detail',
      title: 'Example',
      url: 'https://example.com',
      mainText: 'Hello world.',
    }),
    {
      engine: 'runtime',
      surface: 'detail',
      title: 'Example',
      url: 'https://example.com',
      summary: 'Hello world',
      main_text: 'Hello world.',
    }
  );
});

test('buildPageProjection includes markdown only when provided', () => {
  assert.deepEqual(
    buildPageProjection({
      engine: 'data',
      surface: 'content',
      title: 'Example',
      url: 'https://example.com',
      mainText: 'Hello world.',
      markdown: '# Example\n\nHello world.',
    }),
    {
      engine: 'data',
      surface: 'content',
      title: 'Example',
      url: 'https://example.com',
      summary: 'Hello world',
      main_text: 'Hello world.',
      markdown: '# Example\n\nHello world.',
    }
  );
});
