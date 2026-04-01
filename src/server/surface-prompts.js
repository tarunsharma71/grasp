const BOUNDARY_PROMPT_PACKS = {
  public_read: {
    id: 'public_read',
    instructions: [
      'Operate as a read-first agent inside the current Grasp runtime boundary.',
      'Keep the flow on inspect/extract style tools until the runtime evidence shows a different surface.',
      'Do not mutate the page or jump into form/workspace actions from a readable public page.',
    ],
  },
  live_session: {
    id: 'live_session',
    instructions: [
      'Operate inside the current authenticated browser session instead of replaying from scratch.',
      'Inspect the live page first and wait for clear evidence before switching into a specialized surface.',
      'Reuse the current session state and avoid speculative deep actions.',
    ],
  },
  session_warmup: {
    id: 'session_warmup',
    instructions: [
      'Treat this as a trust-warmup path, not a direct action path.',
      'Preheat the session, then re-enter once the runtime trust improves.',
      'Avoid blind retries that keep re-triggering the same low-trust entry.',
    ],
  },
  form_runtime: {
    id: 'form_runtime',
    instructions: [
      'Operate as a guarded form agent.',
      'Inspect first, fill safe text fields conservatively, and keep review-tier controls explicit.',
      'Submit only through safe_submit with the required confirmation gate.',
    ],
  },
  workspace_runtime: {
    id: 'workspace_runtime',
    instructions: [
      'Operate as a guarded workspace agent on the current live item.',
      'Keep selection stable, draft before execute, and verify outcome after every execution.',
      'Never bypass the guarded workspace tools with raw send-like actions.',
    ],
  },
  handoff: {
    id: 'handoff',
    instructions: [
      'Operate as a handoff coordinator rather than a direct actor.',
      'Stop blind retries, persist the blocked step, and wait for the human recovery action.',
      'Resume only after the runtime evidence shows the page has been reacquired.',
    ],
  },
};

const SURFACE_PROMPT_PACKS = {
  public_content: {
    id: 'public_content',
    instructions: [
      'Surface: readable public content.',
      'Prefer inspect, extract, extract_structured, extract_batch, share_page, and continue.',
    ],
  },
  public_search: {
    id: 'public_search',
    instructions: [
      'Surface: public search or navigation-heavy content.',
      'Stay conservative and extract the visible result state before deeper actions.',
    ],
  },
  live_auth_session: {
    id: 'live_auth_session',
    instructions: [
      'Surface: authenticated session shell without a specialized task surface yet.',
      'Use inspect, continue, and explain_route until form or workspace evidence becomes explicit.',
    ],
  },
  live_runtime_surface: {
    id: 'live_runtime_surface',
    instructions: [
      'Surface: generic live runtime page.',
      'Preserve the current session context and avoid premature specialization.',
    ],
  },
  session_reentry: {
    id: 'session_reentry',
    instructions: [
      'Surface: warmup and re-entry.',
      'Focus on trust recovery and re-entry rather than content extraction or page mutation.',
    ],
  },
  form_surface: {
    id: 'form_surface',
    instructions: [
      'Surface: visible form.',
      'Match labels conservatively, avoid blind writes, and keep sensitive fields out of automatic writes.',
    ],
  },
  form_review_required: {
    id: 'form_review_required',
    instructions: [
      'Surface: form still requires review.',
      'Resolve blockers and review-tier fields first; do not confirm submit while the form still needs review.',
    ],
  },
  form_ready_to_submit: {
    id: 'form_ready_to_submit',
    instructions: [
      'Surface: form appears ready to submit.',
      'Keep the final step explicit and use safe_submit with the required confirmation string.',
    ],
  },
  workspace_surface: {
    id: 'workspace_surface',
    instructions: [
      'Surface: authenticated workspace.',
      'Inspect the visible live items and composer state before taking guarded actions.',
    ],
  },
  workspace_list: {
    id: 'workspace_list',
    instructions: [
      'Surface: workspace list.',
      'Select the live item first; do not draft or execute until the target item is stable.',
    ],
  },
  workspace_detail: {
    id: 'workspace_detail',
    instructions: [
      'Surface: workspace detail panel.',
      'Keep the selected item aligned with the detail view before drafting or executing.',
    ],
  },
  workspace_thread: {
    id: 'workspace_thread',
    instructions: [
      'Surface: workspace thread.',
      'Draft in the active composer, keep the active item stable, and execute only through execute_action.',
    ],
  },
  workspace_composer: {
    id: 'workspace_composer',
    instructions: [
      'Surface: focused composer.',
      'Draft safely, keep send guarded, and verify the result after any execution.',
    ],
  },
  workspace_loading_shell: {
    id: 'workspace_loading_shell',
    instructions: [
      'Surface: loading shell.',
      'Re-inspect after the workspace stabilizes and avoid acting while the shell is still loading.',
    ],
  },
  checkpoint_handoff: {
    id: 'checkpoint_handoff',
    instructions: [
      'Surface: gated checkpoint or blocker.',
      'Request handoff, stop direct action loops, and wait for the human recovery step.',
    ],
  },
};

export function getBoundaryPromptPack(key) {
  return key ? BOUNDARY_PROMPT_PACKS[key] ?? null : null;
}

export function getSurfacePromptPack(key) {
  return key ? SURFACE_PROMPT_PACKS[key] ?? null : null;
}
