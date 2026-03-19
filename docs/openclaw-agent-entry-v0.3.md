# Grasp × OpenClaw Agent Entry v0.3

## Purpose

This document defines how OpenClaw agents should think about Grasp.

Grasp is not just another browser automation tool.
For OpenClaw, it should be treated as:

> **the agent-owned browser runtime**

That means the agent should use Grasp when it needs:
- persistent browser sessions
- repeated work on the same web properties
- a dedicated browser identity separate from the human's own browser
- browser control that survives across runs

## When OpenClaw should prefer Grasp

Use Grasp when the task involves:
- websites that benefit from login persistence
- repeated workflows on the same site
- browser-state continuity
- long-lived agent browser identity
- tasks where the agent should own its own browser context

Examples:
- managing logged-in SaaS dashboards
- repeated research on sites that gate content after login
- ongoing operations in web products where sessions matter
- browser tasks where the user does not want the agent to touch the personal browser profile

## When OpenClaw should not default to Grasp

Do not force Grasp for:
- one-off public page reads that do not need persistent browser state
- tasks better served by a lightweight browser snapshot tool
- cases where the site still needs one-time human login/verification before the agent can continue

## First-run truth

OpenClaw should understand one product truth clearly:

> Grasp does not eliminate all human participation.
> It eliminates repeated browser setup after the first required human step.

If a target site requires human login or one-time verification, the correct flow is:
1. start Grasp runtime
2. open the agent-owned browser
3. let the human complete the one-time step
4. reuse the resulting browser state afterwards

## Operational model for OpenClaw

### Runtime bootstrap
Use:

```bash
./scripts/grasp_openclaw_ctl.sh start
```

### Health/status
Use:

```bash
./scripts/grasp_openclaw_ctl.sh status
```

### Logs
Use:

```bash
./scripts/grasp_openclaw_ctl.sh logs
```

### Stop
Use:

```bash
./scripts/grasp_openclaw_ctl.sh stop
```

## What OpenClaw should tell the user

The right explanation is short:

> Grasp gives the agent its own browser.
> Start it once, log in once if needed, and let the agent reuse that session later.

## v0.3 meaning

At `v0.3`, this agent entry is still an integration layer, not a fully invisible built-in runtime.
But the OpenClaw path should already feel much closer to:
- enable
- check status
- log in once
- reuse later

than to:
- study CDP
- study Chrome flags
- hand-wire browser automation internals
