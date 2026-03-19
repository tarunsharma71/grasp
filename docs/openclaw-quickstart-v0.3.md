# Grasp × OpenClaw Quickstart v0.3

## Goal

Give an OpenClaw agent its own browser without making the user manage Chrome flags, CDP setup, or process plumbing manually.

## Current path

Use the OpenClaw launcher wrapper:

```bash
./scripts/grasp_openclaw_ctl.sh start
```

Then check status:

```bash
./scripts/grasp_openclaw_ctl.sh status
```

Expected healthy output includes:
- `chromium=running`
- `cdp=connected`
- `grasp_probe=running`

## Runtime locations

- runtime dir: `.runtime/openclaw/`
- default profile dir (Snap Chromium): `/root/snap/chromium/common/grasp-openclaw-profile`
- chromium log: `.runtime/openclaw/logs/chromium.log`
- grasp log: `.runtime/openclaw/logs/grasp.log`

## First-run model

Grasp is not about bypassing verification pages.
It is about giving the agent its own browser profile.

That means the intended flow is:
1. Start the OpenClaw wrapper
2. Open the agent-owned browser session
3. Let a human complete any one-time login / verification needed by the target site
4. Reuse that browser state on later runs

## Stop / logs

```bash
./scripts/grasp_openclaw_ctl.sh logs
./scripts/grasp_openclaw_ctl.sh stop
```

## Meaning of v0.3

At `v0.3`, the OpenClaw goal is:
- low-friction local startup
- stable browser/CDP bootstrap
- explicit persistent browser profile
- simple health/status path

This is the first OpenClaw-ready path, not the final packaged integration.
