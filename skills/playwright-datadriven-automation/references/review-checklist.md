# Human review checklist

Run after step 3 (page objects), after step 4 (spec), and after **every** real execution.

Each item below corresponds to a defect that actually occurred. "Symptom" is what you see; "Why it
survived" explains why the AI's own self-review did not catch it.

---

## A. Defects that destroy diagnosability

### A1 · Reading the DOM before asserting the element exists

- **Check:** list every DOM read (`innerText`, `textContent`, `inputValue`, `getAttribute`). For
  each, ask: is that element guaranteed to exist at the moment of the call?
- **Symptom:** the test fails with `TimeoutError: locator.innerText` instead of with an assertion.
  The carefully written message is never printed.
- **Why it survived:** a meticulously written assertion message creates the impression that
  diagnostics are handled, while the **path to the message** is the broken part. It only surfaces
  when the system fails in the specific way that removes the element — that is, exactly the cases
  where the information matters most.
- **Fix:** assert presence first, read afterwards. Values used only to build a message must be
  wrapped in a catch returning a descriptive string. There is no third option.

### A2 · Shared invariants asserted before case-specific claims

- **Check:** inside the test body, do invariants that apply to every case run before the claim
  specific to this case?
- **Symptom:** the report opens with "the two sources disagree" when the point is "the system
  accepted an empty value".
- **Why it survived:** both assertions are correct and both are red; only ordering decides what the
  reader understands.
- **Fix:** case-specific claim first, shared invariant second. The invariant is the net that catches
  what the specific claim misses — putting it first lets the net hide the fish.

### A3 · Unasserted preconditions

- **Check:** is every precondition (signed in, on the right screen, fixture data ready) asserted
  before the first action?
- **Symptom:** a timeout clicking an element that should exist; annotations recording "not measured".
- **Why it survived:** a consequence of a **good** principle applied halfway — setup helpers should
  not assert (correct), but the spec did not take over that responsibility (incorrect). The
  precondition became territory nobody guards.
- **Fix:** the spec asserts the precondition, with a message naming the likely cause.

---

## B. Defects that neutralise assertions

### B1 · Tautological assertions

- **Check:** is there anywhere that sets a value and then reads back that same value?
- **Symptom:** **none.** The test is always green.
- **Why it matters:** if that is the only case covering a specification branch, the branch is not
  being tested at all, and nobody knows.
- **Fix:** separate the read-only accessor from the setter. Read, then compare against an
  independent source.

### B2 · Comparison keys not normalised uniformly

- **Check:** do both data sources pass through **the same** normalisation function? Is every branch
  of a labelled union normalised the same way?
- **Symptom:** mismatches in exactly the cases where both sides look identical apart from one
  formatting character.
- **Why it survived:** the main branch was thought through and normalised correctly; the edge
  branches were forgotten — and those are precisely the branches created to handle unusual values.
- **Fix:** build every branch's comparison key from the normalised string; the raw string goes only
  into the message.

### B3 · Oracle computed by the machine under suspicion

- **Check:** what operation computes the expected side? Is it the same operation the system uses?
- **Symptom:** none. The assertion is a tautology.
- **Fix:** see `oracle-patterns.md` section 1.

### B4 · Assertions with a time window

- **Check:** does any assertion depend on the **disappearance** of an element that reverts on its
  own after a delay?
- **Symptom:** irregular flakiness, hard to reproduce.
- **Fix:** assert positively on an element that exists only in the desired state.

---

## C. Scope defects

### C1 · Inference beyond the specification

- **Check:** can every assertion answer "what does the specification say?" Is any case outside the
  designed set? Is any constraint asserted that the specification never states?
- **Symptom:** an expectation that sounds reasonable but cites no clause.
- **Why it survived:** models tend to fill in what they perceive as gaps.
- **Fix:** disappears after one explicit scope statement in the prompt. Did not recur in later
  features, even with a different AI tool.

### C2 · Expectations derived from observed behaviour

- **Check:** did the AI ask "what does the system actually do?"
- **Action:** **do not answer.** That question signals it is about to describe the defect rather
  than test for it.

### C3 · Business inference promoted to a hard assertion

- **Check:** is any assertion based on "this seems unreasonable" rather than on a specification
  clause?
- **Fix:** the specification is the hard assertion; business inference goes into annotations and the
  bug report with a provenance label. Failing a test on inference leaves the reader unable to
  distinguish "the system is wrong" from "we expected more".

---

## D. Post-run checks

- Every failure classifies as: system defect / script defect / tool limitation. If it cannot be
  classified from the message, fix the message before fixing anything else.
- Many failures with **identical** messages → suspect one shared root cause masking other defects.
  Resolve the root cause and rerun before drawing conclusions.
- A **green** case surrounded by red ones → check whether it is green because it is correct or
  because the action never happened. This is the easiest thing to miss.
- Results **identical across all three browsers** → server-side defect. **Divergent by browser** →
  engine differences in input handling. Report both, but only the first belongs in the bug report.
- Run a second time against the same database — do results change? If so, state isolation is
  incomplete.

---

## E. Pre-submission checks

- No `skip` / `fixme` / `fail` on any case
- No hardcoded data in spec files — including name strings and currency constants
- No `expect` inside page objects
- No fixed-duration waits
- Every report carries the run identity and a timestamp
- Cases that could not be automated are listed separately with reasons and unblocking conditions —
  none of them hidden
