# The five-prompt chain — generic form

Replace every `{{...}}` with content from the feature at hand. **Run them in sequence**, pasting
each output before moving on. A human review pass sits between steps — see `review-checklist.md`.

After each step, save the verbatim prompt, the verbatim output, and a timestamp.

---

## PROMPT 1 — Context and technical contract. NO CODE.

```
You are a senior test automation engineer. We will work through several steps. In this step you
must NOT write any code — answer only the questions at the end.

## Stack and execution model
Playwright Test + TypeScript, ESM, Node {{NODE_VERSION}}, {{OPERATING_SYSTEM}}.
Three browser projects: {{BROWSER_LIST}}.
{{CONCURRENCY_MODEL — state the worker count and how the runner spawns processes,
  because it determines the state isolation strategy}}

## Existing repository modules (DO NOT modify, only use)
{{MODULE_LIST_WITH_SIGNATURES}}

## Mandatory constraints
1. Specs import { test, expect } from '{{FIXTURES_PATH}}', never from '@playwright/test'
   (not even type-only imports — use the re-export so the rule stays machine-checkable).
2. NO hardcoded data arrays or objects in specs. All data lives in {{DATA_DIRECTORY}}.
3. At least three distinguishable assertion KINDS, numbered at the top of the file and marked
   at each use site.
4. Page objects contain no expect.
5. No test.skip / test.fixme / test.fail.
6. No fixed-duration waits. Use auto-retrying assertions or condition-based waits.
7. NEVER read a value from the DOM before an assertion guarantees the element exists; if the
   value is used only to build a failure message, wrap it in a catch.
8. Comments in {{LANGUAGE}}, explaining "why" rather than restating "what".

## Specification for {{FEATURE_ID}} — the ONLY source of truth
{{VERBATIM_SPECIFICATION_QUOTE}}

Derivable consequences: {{CONSEQUENCES}}
The specification says NOTHING about: {{WHERE_THE_SPEC_IS_SILENT}}
Do not invent constraints where the specification is silent.

## Real DOM structure
{{RENDERED_HTML — not UI framework source}}
State explicitly: are there test-specific identifier attributes; are labels associated with
inputs; which elements change content by state; which regions on the same screen are easy to
confuse with the target region.

## Session / authentication state
{{STORAGE_LOCATION + KEY + WHETHER_IT_SURVIVES_A_RELOAD}}

## APIs for building and cleaning preconditions (NOT under test)
{{ENDPOINT_LIST + which require authentication + any uniqueness constraints}}

## Your task in THIS step — answer in prose, no code

(a) STATE. Run the suite twice in a row against the same database: which cases produce different
    results between run 1 and run 2? Explain the mechanism. Propose an isolation strategy: what
    is created when, deleted when, and what happens if the process is killed before cleanup.
    {{IF_SHARED_SEED_DATA_EXISTS: state your position on whether tests may modify it}}

(b) ORACLE. After the action, how many sources of truth do you have about the resulting state?
    Must they agree, and on what grounds? If they disagree, where is the defect? How do you
    design assertions that detect the disagreement rather than silently trusting one source?

(c) SELECTORS. Propose location strategies for {{ELEMENT_LIST}}, explaining why each is more
    durable than the alternatives. State how you avoid confusing them with {{CONFUSABLE_REGION}}.

(d) List the information still missing that prevents you from writing tests with confidence.
```

**Review pass after prompt 1.** Check three things:
- Did it ask "what does the system actually do?" → **refuse to answer**, state why
- Did it add cases outside the agreed scope → block immediately
- Did it propose any assertion relying on the **disappearance** of a self-reverting element → block

---

## PROMPT 2 — Data file design

```
Step 2: design the data file. Still no spec.

{{TEST_CASE_TABLE — case ID, inputs, which factor is invalid, specification-derived expectation}}

Every case keeps all other factors valid, AND those valid factors must sit FAR from their own
boundaries — so that a single failure has exactly one possible explanation.

Requirements for the data file:
- Path: {{PATH}}
- Self-describing: reading one row tells you what the case checks and on what grounds, with NO
  need to open the spec
- Columns for the original case ID, the design technique, the boundary position, the verbatim
  specification basis, and the provenance of the oracle (specification / inference / observation)
- Encode the difference between EXPECTATION BRANCHES so the spec needs one table-driven loop
- Encode the difference in INTERACTION METHOD, not only in input values
- Special values (empty, absent, unspecified) must be distinguishable from one another; state
  the convention you choose
- Long values must not be pasted literally — encode them as length plus a generation rule

Choose the file format yourself, but justify the choice.

Return: the complete file contents + a table explaining each column + the special-value conventions.
```

**Review pass after prompt 2.** Check: traceability columns are **inert** (no branch may read them
to decide behaviour); large numeric values are stored as strings; cases needing different
interaction methods are separated by data rather than by conditionals in code.

---

## PROMPT 3 — Page objects and the state layer

```
Step 3: page objects + precondition setup/teardown. Still no spec.

3a. {{PAGE_OBJECT_PATH}}
    Minimum methods: {{METHOD_LIST}}
    - Locators as readonly properties, constructed once in the constructor
    - Divide the screen into REGIONS in the constructor; every locator starts from a region,
      never from the whole page
    - Value-reading methods return BOTH the normalised form AND the verbatim display string
    - No expect in this file
    - Each locator carries a comment: why this location strategy, and when it breaks

3b. {{STATE_FIXTURE_PATH}}
    Create precondition data; clean it up afterwards.
    - Generated identifiers must be recognisable as belonging to this run, prefix at the START
    - Build preconditions through the API, not through the UI
    - Cleanup runs even when the test fails or times out
    - State explicitly: what remains if the process is killed, and why the remnant is harmless

3c. Session setup
    Present two approaches, choose one, explain the trade-off. Remember: {{AUTH_FEATURE}} is NOT
    under test for this feature.
    Setup helpers do NOT assert — but they must expose enough for the spec to assert the
    precondition itself.
```

---

## PROMPT 4 — The spec

```
Step 4: write {{SPEC_PATH}}.

- Table-driven loop, NO conditionals branching on case ID. If you find yourself writing a branch
  for one specific case ID, go back and fix the data file instead.
- List the assertion KINDS at the top, numbered, and mark each use site.
- Case-SPECIFIC claims assert FIRST; shared invariants assert SECOND.
- Rejection cases: evidence must include both the presence of the rejection signal AND the absence
  of the success signal. Checking only one is insufficient — state why in a comment.
- Do NOT assert error message contents unless the specification prescribes them. But DO record the
  verbatim message in an annotation for every case, including passing ones.
- Every assertion carries a message containing the REAL value read from the system.
- Test titles begin with the original case ID.
- Annotate: the specification basis for the case, and the measurements taken before and after
  the action.

Return the complete file.
```

---

## PROMPT 5 — Make the AI critique itself

```
Step 5: self-review. Do not rewrite code.

1. List EVERY DOM read. For each: is the element guaranteed to exist at that moment? If not,
   how do you handle it?
2. Which assertions still pass even when the system is broken? Give the specific failure scenario
   they miss.
3. Which tests depend on another test having run? Identify the mechanism.
4. Run the suite twice without resetting data — which cases change result?
5. Which assumptions did you introduce that the specification does not state?
6. Which cases cannot be reliably automated, and why?
7. If the two data sources give different answers, how clearly does your suite report that?
8. After 50 runs, what does the suite leave behind in the system?
```

**Important caveat:** this self-review is useful but **not sufficient**. In the real application, all
four of the most serious defects passed step 5 without the AI catching them. The human review pass
is mandatory, not optional.
