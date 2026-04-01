import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentPrompt } from '../../src/server/prompt-assembly.js';

test('buildAgentPrompt assembles a public_read prompt from route and content surface', () => {
  const prompt = buildAgentPrompt({
    status: 'direct',
    page: {
      title: 'Example',
      url: 'https://example.com',
      page_role: 'content',
      risk_gate: false,
      grasp_confidence: 'high',
    },
    continuation: {
      can_continue: true,
      suggested_next_action: 'extract',
      handoff_state: 'idle',
    },
    route: {
      selected_mode: 'public_read',
      next_step: 'extract',
    },
  });

  assert.equal(prompt.boundary_key, 'public_read');
  assert.equal(prompt.surface_key, 'public_content');
  assert.equal(prompt.prompt_pack.boundary, 'public_read');
  assert.equal(prompt.prompt_pack.surface, 'public_content');
  assert.match(prompt.system_prompt, /Current boundary: public_read/);
  assert.match(prompt.system_prompt, /Surface pack: public_content/);
  assert.match(prompt.system_prompt, /Next best step: extract/);
  assert.ok(prompt.segments.length >= 3);
});

test('buildAgentPrompt assembles a workspace thread prompt pack from workspace surface evidence', () => {
  const prompt = buildAgentPrompt({
    status: 'direct',
    page: {
      title: '公众号',
      url: 'https://mp.weixin.qq.com/cgi-bin/message?t=message/list&count=20&day=7',
      page_role: 'workspace',
      risk_gate: false,
      grasp_confidence: 'high',
    },
    result: {
      task_kind: 'workspace',
      workspace: {
        workspace_surface: 'thread',
      },
    },
    continuation: {
      can_continue: true,
      suggested_next_action: 'workspace_inspect',
      handoff_state: 'idle',
    },
    route: {
      selected_mode: 'workspace_runtime',
      next_step: 'workspace_inspect',
      evidence: {
        workspace_surface: 'thread',
      },
    },
  });

  assert.equal(prompt.boundary_key, 'workspace_runtime');
  assert.equal(prompt.surface_key, 'workspace_thread');
  assert.equal(prompt.prompt_pack.boundary, 'workspace_runtime');
  assert.equal(prompt.prompt_pack.surface, 'workspace_thread');
  assert.match(prompt.system_prompt, /Current boundary: workspace_runtime/);
  assert.match(prompt.system_prompt, /Surface pack: workspace_thread/);
  assert.match(prompt.system_prompt, /execute only through execute_action/i);
});

test('buildAgentPrompt sharpens the form prompt when the current form still needs review', () => {
  const prompt = buildAgentPrompt({
    status: 'direct',
    page: {
      title: 'Apply',
      url: 'https://example.com/apply',
      page_role: 'form',
      risk_gate: false,
      grasp_confidence: 'high',
    },
    result: {
      task_kind: 'form',
      form: {
        completion_status: 'review_required',
      },
    },
    continuation: {
      can_continue: true,
      suggested_next_action: 'verify_form',
      handoff_state: 'idle',
    },
    route: {
      selected_mode: 'form_runtime',
      next_step: 'form_inspect',
    },
  });

  assert.equal(prompt.boundary_key, 'form_runtime');
  assert.equal(prompt.surface_key, 'form_review_required');
  assert.equal(prompt.prompt_pack.surface, 'form_review_required');
  assert.match(prompt.system_prompt, /Surface pack: form_review_required/);
  assert.match(prompt.system_prompt, /do not confirm submit/i);
});
