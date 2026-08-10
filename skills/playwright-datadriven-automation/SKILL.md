---
name: playwright-datadriven-automation
description: Generate, review and maintain data-driven Playwright test suites that run across multiple browsers, starting from an existing set of designed test cases (domain testing / boundary value analysis). Use when converting manual test cases into automated scripts, when building trustworthy oracles for currency or data state, when isolating state between runs, or when reviewing AI-generated test code before trusting its results.
---

# Data-driven, multi-browser Playwright automation

This skill is distilled from one real application: 54 test cases, 162 executions across 3 browsers,
13 defects found in the system under test — and **8 defects found in the AI-generated test code
itself**, four of which were "correct mechanism disabled by one broken link", the class of defect
the AI could not catch in its own self-review.

## Founding principles

These four decide suite quality more than any technical choice.

**1. Expectations come from the SPECIFICATION, never from observed behaviour.**
Writing assertions against what the system currently does produces a suite that is permanently
green and can never find a defect. When the AI asks "what does the system actually do when I enter
X?", **do not answer** — that question is the signal it is about to describe the bug instead of
testing for it.

**2. The oracle must not be computed by the machine under suspicion.**
If the expected side is computed with the same operation the system uses, then when that operation
is wrong both sides are wrong identically and the assertion becomes a tautology. See
`references/oracle-patterns.md`.

**3. Block what causes FALSE GREEN; allow what causes LOUD RED.**
A test that fails for the wrong reason costs one run to diagnose. A test that passes for the wrong
reason is never noticed. When deciding whether to warn the AI about a trap or let it walk in, ask:
if it falls for this, is the result red or green?

**4. Read HOW tests fail, not just HOW MANY fail.**
Three of the four most serious defects were found by looking at the shape of the failure message —
a timeout instead of an assertion, a comparison key off by one character, a diagnostic message that
was never printed.

## Workflow

### Step 0 — Entry requirements

Have these before starting:

- A designed set of test cases (domain testing / BVA) with IDs, inputs and expected outcomes
- **Verbatim specification quotes** for every constraint — the original wording, not a paraphrase
- **Real DOM structure** of the relevant screens, taken from rendered HTML or from UI source
- The list of APIs available for setup and teardown, noting which require authentication
- A running, reachable system

If items 2 or 3 are missing, stop and collect them. Generating scripts without the real DOM
produces guessed selectors, and every subsequent fix cycle costs more than the initial collection
would have.

### Step 1 — Build the harness, accept it with a smoke suite

Copy from `assets/`:

| File | Role |
|---|---|
| `playwright.config.template.ts` | Three browser projects; reports split per (feature, browser) pair |
| `fixtures.template.ts` | Extended `test`, network guard, type re-exports |
| `run-matrix.mjs` | Runs the feature × browser matrix and stamps each report |
| `stamp-report.mjs` | Injects run identity and an ISO timestamp into the HTML report |
| `verify-reports.mjs` | Self-checks the evidence before submission |

Write a smoke spec that verifies the system is ready. **Do not proceed until smoke passes on all
three browsers.** Without it, every later environment failure will be misread as a script failure.

Three harness traps already encountered, detailed in `references/infrastructure-traps.md`:
- `localhost` resolving to IPv6 while the server listens only on IPv4
- WebKit on Windows crashing when video recording is enabled
- An `auto: true` fixture depending on `page`, forcing browser startup for API-only tests

### Step 2 — The generation prompt chain

**Never use one combined prompt.** Split into five steps, each producing one artefact, with **a
human review pass between steps**. Full text in `references/prompt-chain.md`.

| Prompt | Content | Artefact | Forbidden |
|---|---|---|---|
| 1 | Context, technical contract, specification, real DOM | Selector strategy, list of assumptions | **No code** |
| 2 | Turn the test case set into a data file | `.csv` / `.json` | No spec yet |
| 3 | Page objects + state setup/teardown layer | Page and utility modules | No `expect` in page objects |
| 4 | Data-driven spec | Spec files | No hardcoded data, no skips |
| 5 | Make the AI critique itself | Self-review table | — |

Forbidding code in prompt 1 is the single most valuable constraint: it forces the AI to surface its
assumptions **before** those assumptions reach the code, and its answer is itself the evidence for
a "drive the AI step by step" requirement.

### Step 3 — Human review

Run `references/review-checklist.md` after step 3, after step 4, and after every real run.

The four most common defect classes, ordered by danger:

1. **Reading the DOM before asserting the element exists** → diagnostic messages never printed
2. **Comparison keys built from raw display strings** → systematic false positives
3. **Tautological assertions** (set a value, then read back that same value) → permanently green
4. **Unasserted preconditions** → silent failures surface as meaningless timeouts

All four survived the AI's own step-5 self-review. The human pass is mandatory.

### Step 4 — Run and triage

Run **one browser first**, triage, then expand to all three. The first run is for classification,
not for collecting submission evidence.

Every failure belongs to exactly one of three classes:

| Class | Signal | Action |
|---|---|---|
| System defect | Specification assertion unsatisfied, message contains real values | Goes to the bug report |
| Script defect | Timeout, locator error, mismatched comparison key | Fix the script, record in the review |
| Tool limitation | The framework refused the operation | Record it; not a system defect |

If a failure cannot be classified from its message, that is a sign the assertion lacks a message.
Fix the message before fixing anything else.

### Step 5 — Full matrix and evidence self-check

```
node scripts/run-matrix.mjs              # every feature × every browser
node scripts/verify-reports.mjs          # identity and timestamp present in every report
```

Results **identical across all three browsers** point to a server-side defect. Results **that
diverge by browser** point to engine differences in input element handling. This distribution is
itself a classification of which layer the defect lives in — worth stating in the report.

## Design boundaries to hold

| Boundary | Reason |
|---|---|
| Page objects contain no `expect` | An assertion inside a page object follows every reuse, and the report names the method instead of the test case |
| Setup helpers do not assert | But the spec **must** assert the precondition, otherwise it becomes territory nobody guards |
| Data in separate files, specs hold only logic | Changing a boundary value needs no code change, and a reader understands the case without opening the spec |
| Case-specific claims assert **before** shared invariants | Playwright stops at the first failure; the first line decides what the reader understands |
| Never read the DOM before asserting existence | If the value is only used to build a message, wrap it in a catch — there is no third option |

## Reference material

- `references/prompt-chain.md` — the full five prompts, with per-feature placeholders
- `references/review-checklist.md` — human review checklist with symptoms for each defect
- `references/oracle-patterns.md` — currency oracles, dual-source oracles, state isolation
- `references/infrastructure-traps.md` — environment traps and how to recognise them
- `assets/` — harness files to copy straight into a new project
