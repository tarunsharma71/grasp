# Grasp v0.3 Plan

> Version target: **v0.3.0**
>
> Theme: **OpenClaw-ready agent browser runtime**

---

## Why v0.3 exists

`v0.3.0` is the release where Grasp moves from a strong standalone browser MCP project toward an OpenClaw-ready agent browser runtime:
- the local MCP server works
- the dedicated browser profile model is real
- the persistent-agent-browser story is valid
- Codex / Claude Code / Cursor have already been validated

What is still missing is the next decisive step:

# **make Grasp usable inside OpenClaw without making users study browser internals, CDP flags, or MCP plumbing.**

That is the real purpose of `v0.3.0`.

---

## v0.3 product goal

### One-sentence goal

# **Turn Grasp from a strong standalone MCP browser project into an OpenClaw-ready agent browser runtime.**

### Product promise

An OpenClaw user should not need to manually figure out:
- how to launch Chrome with CDP
- which flags are required
- where the dedicated profile should live
- how to keep the browser session persistent
- how to connect Grasp to the runtime

Instead, the experience should feel like:

> enable Grasp once,
> log in once in the agent-owned browser,
> let the agent keep using that browser session afterwards.

---

## v0.3 definition of done

`v0.3.0` is done when all of the following are true:

### A. OpenClaw environment path is real
- Grasp can be launched from a stable OpenClaw-oriented local entrypoint
- Chrome/Chromium can be started with the correct CDP flags automatically
- the dedicated browser profile is explicit and persistent
- health/status can be checked without manual log hunting

### B. OpenClaw user experience is low-friction
- a user can follow a short setup path without reading deep internals
- first-run guidance explains the “log in once, reuse later” model clearly
- common failure cases are surfaced in plain language

### C. Browser-runtime value is visible
- Grasp can open real sites from the dedicated browser runtime
- persistent browser ownership is explained as the product value, not just “automation”
- OpenClaw users can understand why Grasp matters

### D. Packaging/distribution no longer misleads users
- README no longer implies that `npx grasp` is the correct universal install path if it resolves to the wrong npm package
- distribution story is explicit and safe

---

## v0.3 primary workstreams

## 1. OpenClaw integration path

### Goal
Create the first stable OpenClaw-oriented usage path.

### Deliverables
- [ ] Define a canonical OpenClaw launch path for Grasp
- [ ] Add an OpenClaw-oriented local wrapper / launcher script
- [ ] Standardize runtime paths for:
  - [ ] browser profile
  - [ ] logs
  - [ ] pid / lifecycle
- [ ] Add OpenClaw-specific status/health checks
- [ ] Document the minimum OpenClaw smoke test path

### Notes
This workstream is about making Grasp actually usable in OpenClaw, not just theoretically compatible with it.

---

## 2. Browser runtime bootstrap UX

### Goal
Hide CDP/browser startup complexity from end users.

### Deliverables
- [ ] Wrapper starts Chrome/Chromium with the correct flags automatically
- [ ] Wrapper handles headless / no-display environments explicitly
- [ ] First-run output explains dedicated browser ownership clearly
- [ ] Status output distinguishes:
  - [ ] browser not found
  - [ ] browser not started
  - [ ] CDP unreachable
  - [ ] Grasp server not connected
  - [ ] first-login still needed

### Notes
This is critical. If users have to reverse-engineer CDP startup, `v0.3` has failed.

---

## 3. Persistent-session story

### Goal
Make “log in once, automate forever” real and visible.

### Deliverables
- [ ] Define the persistent profile path explicitly
- [ ] Confirm session survives browser restart
- [ ] Document first-login / first-verification workflow
- [ ] Add guidance for how agent-owned browser differs from the human’s browser
- [ ] Add one real validation scenario proving session reuse matters

### Notes
This is the core product value of Grasp. Without this, the project collapses back into generic browser automation.

---

## 4. Packaging and installation cleanup

### Goal
Remove install ambiguity and prevent wrong-package onboarding.

### Deliverables
- [ ] Fix README install guidance so users do not accidentally invoke the unrelated `grasp` npm package
- [ ] Document the currently correct install path clearly
- [ ] Decide whether package renaming or scoped publishing is required
- [ ] Add explicit OpenClaw installation / local-run instructions

### Notes
Current npm collision is a product-level problem, not just a docs nit.

---

## 5. Product narrative upgrade

### Goal
Tell the right story for `v0.3`.

### Deliverables
- [ ] Reframe Grasp as an **agent-owned browser runtime**
- [ ] Make OpenClaw a first-class validated environment in docs
- [ ] Clarify that Grasp is not about bypassing verification, but about preserving valid browser state after human login
- [ ] Add an OpenClaw-focused explanation of why dedicated browser ownership matters

### Notes
The right product story is stronger than “browser automation via MCP.”
The real story is: **AI gets its own browser with durable identity and memory.**

---

## v0.3 explicit non-goals

To keep the release sharp, `v0.3.0` should **not** try to do all of the following:

- [ ] full multi-browser abstraction
- [ ] deep anti-bot bypass work
- [ ] every runtime integration at equal depth
- [ ] complete packaging perfection for every ecosystem
- [ ] full autonomous login / auth orchestration

Those can come later.

`v0.3` wins by making the OpenClaw path real and clean.

---

## v0.3 validation checklist

A release candidate should pass these checks:

### Core runtime
- [ ] Grasp process starts successfully from the documented path
- [ ] browser launches with dedicated profile
- [ ] CDP is reachable
- [ ] `grasp status` reports connected/live state

### OpenClaw path
- [ ] OpenClaw-oriented setup instructions are sufficient for a fresh user
- [ ] at least one OpenClaw-side smoke path is documented and verified
- [ ] failure modes are understandable without source-code reading

### Product value
- [ ] dedicated profile path is visible and intentional
- [ ] “log in once, reuse later” is demonstrated
- [ ] README does not oversell unsupported installation paths

---

## Proposed release message

### v0.3.0

# **Grasp becomes OpenClaw-ready.**

This version focuses on turning Grasp into a practical agent browser runtime for OpenClaw users:
- cleaner local launch path
- better browser/CDP bootstrap handling
- clearer persistent-session model
- safer install guidance
- stronger OpenClaw integration story

---

## Release sequencing

### Step 1 — make the OpenClaw path real
- launcher
- runtime paths
- status/health checks
- quickstart path for OpenClaw users
- agent/skill entry guidance for OpenClaw
- smoke-test validation path for OpenClaw

### Step 2 — clean packaging/docs
- install guidance
- npm collision handling
- OpenClaw usage docs

### Step 3 — validate persistence story
- first login
- restart reuse
- real-world smoke path

### Step 4 — publish `v0.3.0`
- changelog
- release notes
- README updates

---

## Final judgment standard

`v0.3.0` should make this sentence true:

> **An OpenClaw user can give the agent its own browser without becoming a browser automation engineer.**

If that sentence is not yet true, `v0.3.0` is not done.
