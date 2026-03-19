# Grasp v0.3.0 Release Notes

## Theme

**OpenClaw-ready agent browser runtime**

`v0.3.0` is the release where Grasp starts becoming real for OpenClaw.

Earlier versions proved that the agent-owned browser model worked in standalone agent environments such as Claude Code and Codex. `v0.3.0` pushes the project toward a stronger question:

> can OpenClaw users give the agent its own browser without becoming browser automation engineers?

This release is about making that path real.

---

## What changed

### OpenClaw launcher / wrapper
A first OpenClaw-oriented local launcher is now included:

- `scripts/grasp_openclaw_ctl.sh`

It handles:
- browser startup
- CDP bootstrap
- persistent profile path selection
- status checks
- logs
- stop/restart flow

### OpenClaw runtime path
Grasp now has a clearer OpenClaw-oriented runtime layout, including:
- runtime dir
- logs
- pid files
- dedicated browser profile path

### OpenClaw documentation path
`v0.3.0` adds the first OpenClaw-specific integration docs:
- `PLAN.md`
- `docs/openclaw-quickstart-v0.3.md`
- `docs/openclaw-agent-entry-v0.3.md`
- `docs/openclaw-smoke-test-v0.3.md`

These documents define:
- the OpenClaw quickstart path
- when agents should prefer Grasp
- how the dedicated browser profile should be understood
- how to validate the OpenClaw runtime path

### Product boundary made explicit
The design docs and README now state a key truth more clearly:

**Grasp does not eliminate every first gate.**
**It eliminates the repetition of gates.**

For strongly verified or high-friction sites, one-time human login or verification may still be necessary. The product value is that the resulting browser state becomes durable and reusable by the agent afterwards.

---

## What v0.3.0 proves

`v0.3.0` proves that Grasp is not just a standalone MCP browser project. It can now be shaped into an OpenClaw-hosted browser-runtime path with:
- stable Chromium/CDP bootstrap
- a dedicated browser profile
- documented health/status flow
- a clearer OpenClaw user path

It does **not** yet claim:
- full invisible native OpenClaw integration
- universal login automation
- elimination of every verification step on high-friction sites

---

## Meaning

Grasp is no longer only about browser automation.
It is becoming an **agent-owned browser runtime** that OpenClaw can realistically host.

That is the meaning of `v0.3.0`.
