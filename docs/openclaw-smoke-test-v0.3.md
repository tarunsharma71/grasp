# Grasp × OpenClaw Smoke Test v0.3

## Goal

Verify that the OpenClaw-oriented Grasp path is not only documented, but actually usable.

This smoke test focuses on the shortest realistic validation chain:
- browser runtime bootstrap
- CDP connectivity
- Grasp live connection
- opening real pages
- preserving the dedicated browser profile model

---

## Preconditions

Repository available locally.

Run commands from the repository root.

Launcher available:

```bash
./scripts/grasp_openclaw_ctl.sh
```

---

## Test 1 — Start runtime

```bash
./scripts/grasp_openclaw_ctl.sh start
```

Expected:
- launcher exits successfully
- Chromium is started
- CDP becomes reachable
- grasp probe is started

---

## Test 2 — Check health

```bash
./scripts/grasp_openclaw_ctl.sh status
```

Expected healthy output includes:
- `chromium=running`
- `cdp=connected`
- `grasp_probe=running`

---

## Test 3 — Browser/CDP reachability

```bash
curl http://127.0.0.1:9222/json/version
```

Expected:
- returns Chrome/HeadlessChrome version JSON
- includes `webSocketDebuggerUrl`

---

## Test 4 — Grasp live status

```bash
node index.js status
```

Expected:
- `Connection connected (live)`
- Chrome version shown

---

## Test 5 — Open real pages

Open at least one public page through CDP/browser runtime.

Validated examples during current OpenClaw work:
- Zhihu search page: opens successfully
- ChatGPT: reaches site but may show a verification/interstitial page

Interpretation:
- Zhihu success proves browser runtime can reach live websites
- ChatGPT interstitial does **not** disprove Grasp; it indicates that one-time human verification/login may still be required for that dedicated browser profile

---

## Test 6 — Dedicated profile model

Confirm the runtime uses the dedicated browser profile path:

Default Snap Chromium profile path:

```bash
/root/snap/chromium/common/grasp-openclaw-profile
```

Expected:
- profile path exists
- browser state is clearly separated from the human's personal browser profile

---

## Test 7 — Restart path

```bash
./scripts/grasp_openclaw_ctl.sh stop
./scripts/grasp_openclaw_ctl.sh start
./scripts/grasp_openclaw_ctl.sh status
```

Expected:
- runtime comes back cleanly
- CDP reconnects
- grasp probe reconnects
- profile path is unchanged

---

## What this smoke test proves

If all checks above pass, then `v0.3` has proven:
- OpenClaw can bootstrap a Grasp-backed browser runtime
- the browser/CDP layer is real
- the launcher path is usable
- the dedicated browser profile model is intact

It does **not yet** prove:
- full invisible OpenClaw native integration
- automatic handling of every login/verification workflow
- universal support for all target sites

---

## Release meaning

Passing this smoke test means `v0.3` has crossed from:
- theory about OpenClaw compatibility

to:
- a real OpenClaw-hosted browser-runtime path
