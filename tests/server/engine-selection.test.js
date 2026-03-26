import test from 'node:test';
import assert from 'node:assert/strict';

import { selectEngine } from '../../src/server/engine-selection.js';

test('selectEngine uses data engine for ordinary public-web extract reads', () => {
  assert.equal(
    selectEngine({ tool: 'extract', url: 'https://example.com/blog' }).engine,
    'data'
  );
});

test('selectEngine keeps runtime engine for authenticated runtime sites', () => {
  assert.equal(
    selectEngine({ tool: 'extract', url: 'https://mp.weixin.qq.com/' }).engine,
    'runtime'
  );
});

test('selectEngine keeps get_page_summary on the same narrow metadata seam', () => {
  assert.equal(
    selectEngine({ tool: 'get_page_summary', url: 'https://www.zhipin.com/web/geek/chat' }).engine,
    'runtime'
  );
});
