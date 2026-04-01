import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflowPath = new URL('../../.github/workflows/npm-publish.yml', import.meta.url);

test('npm publish workflow releases from version tags with npm auth and version checks', () => {
  const workflow = readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /push:\s*\n\s+tags:\s*\n\s+-\s*['"]v\*['"]/);
  assert.match(workflow, /npm publish/);
  assert.match(workflow, /NPM_TOKEN/);
  assert.match(workflow, /github\.ref_name/);
  assert.match(workflow, /package\.json/);
});
