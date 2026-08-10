# Oracle patterns

Three oracle problems that recur in UI test automation, with solutions verified by real runs.

---

## 1. Currency oracle — never through floating point

### The problem

If the expected side is computed with the same operation the system uses, then when that operation
loses precision both sides are wrong in the same way and the assertion becomes `f(x) === f(x)` — a
tautology.

This blind spot appeared **independently across different AI tools**, so it is a property of the
problem rather than of any one model. Its origin: treating the language's arithmetic as ground
truth, while that arithmetic is exactly what is under test.

### Solution — milli-unit scale with big integers

Pick a three-decimal scale if the default formatter displays at most three decimals. The entire
expected-value path uses big integers, with **no division anywhere**.

```
percent:  discount_milli = total × value × 10        // ≡ total × value / 100 units
fixed:    discount_milli = value × 1000
```

No division means no remainder; no remainder means there is nowhere for a rounding convention to
sneak in.

### Parsing the displayed string

Pure string manipulation, no numeric conversion:

1. Normalise non-breaking spaces (`U+00A0`, `U+202F`) to ordinary spaces
2. Strip the currency symbol and whitespace
3. Extract any leading minus sign into a separate flag
4. Split at the decimal separator; strip grouping separators from the integer part
5. **Right-pad** the fractional part to the scale width — `"1"` means 0.1 and must become `"100"`,
   not `"001"`
6. Combine into a big integer

Step 5 is the most common mistake. Padding the wrong side produces a 1000× error with no exception
raised.

### When the specification is silent about rounding

Do not pick a convention. Picking any convention invents a constraint. Assert instead what **every**
reasonable convention must satisfy:

```
|displayed_discount − exact_value| < 1 unit
displayed_total == displayed_subtotal − displayed_discount        // exact match
```

The second claim is the strong one: it does not need to know how the system rounds, but it catches
immediately if the system rounds in one place and forgets in another — the most common defect in
money arithmetic.

Implement the first claim **literally** as `|d − e| < 1`. Do **not** paraphrase it as "must equal
floor or ceil". If the system does no rounding and displays the exact fractional value, then
`d == e` — which is neither floor nor ceil, yet entirely correct.

### Normalise comparison keys for EVERY branch

If the parser returns a labelled union (`plain` / `scientific` / `empty` / …) to avoid inventing
numbers for unparseable values — a good design — then **the comparison key for every branch must be
built from the normalised string**, not from the raw display string.

Observed defect: only the `plain` branch was normalised; other branches used the raw string, and
strings from the UI always carry a currency symbol while strings from the API never do. Result:
every value that is not an ordinary decimal reported a mismatch, regardless of system correctness.

```
UI:  [scientific:1e+23 ₫]   |   API: [scientific:1e+23]
```

Identical apart from the suffix. Keep the raw string **in the failure message** — it is evidence of
what the user actually sees — but never use it for comparison.

---

## 2. Dual-source oracle — when the UI can lie about the data

### When it is needed

Whenever the specification makes a claim about **data state** ("only that record changes", "the
record is removed from the system") rather than only about display. There are then two sources of
truth — the UI and the API — and a design that looks at only one will miss an entire class of
defect.

### Three tiers

| Tier | Source | Catches |
|---|---|---|
| 1 | UI locators | The target record displays the new value |
| 2 | API re-read | The persisted data was written correctly |
| 3 | **Full-table cross-check** | UI and data disagree about ANY record |

Tiers 1 and 2 can **both pass while the system is broken**: the UI shows the right value because of
optimistic rendering, the API returns the right value because the test looked up the key from its
own setup — while the same write also overwrote a different record. Only a full-table, cross-source
comparison catches that.

### How to compare

Build two normalised snapshots of the **entire** dataset, projected onto the fields both sources
expose, then compare with a deep, auto-retrying assertion. Values from both sources must pass
through **the same** normalisation function — otherwise a difference in the result may be a
difference in the transformation rather than in the data.

For isolation, compute a **diff** and assert the diff is empty, rather than asserting each thing you
happened to think of:

```
Update:  changed = exactly the target key; added empty; removed empty
Delete:  removed = exactly the target key; added and changed empty
Reject:  all three empty
```

The strength lies in asserting an *empty diff*: it catches changes nobody anticipated — which is
precisely the class of defect the isolation claim exists to catch.

### Mandatory sequence

```
act → wait for the UI to settle → snapshot BOTH sources → compare
```

**Never reload the page between the action and the comparison.** A reload forces the application to
re-read from the server, so if the UI is currently diverging from the data, reloading **destroys the
evidence** before it can be recorded.

Once the comparison is done, snapshot and compare a **second** time after a reload. The pair
(before reload, after reload) classifies the cause:

| Before reload | After reload | Diagnosis |
|---|---|---|
| UI new, data old | UI reverts to old | Client renders optimistically and swallows the write error |
| UI old, data new | UI shows correct | Write succeeded but no refetch |
| Both changed, plus another record changed | Still wrong | Write operation missing its filter condition |
| Both changed, but a NEW record appeared instead of an update | Still wrong | Create called instead of update |

Embed this table in the **assertion message**, so the failure log carries diagnostic value rather
than merely stating "expected X, received Y".

### When the two sources disagree, pick neither

The message must print **both** sides and name which source said what. The test has no authority to
decide which is correct — its job is to surface the disagreement.

---

## 3. State isolation

### Classify by where the state lives

| State lives in | Isolation | Note |
|---|---|---|
| Page memory (UI framework state) | **Free** — new context per test | But a page reload wipes it; navigate by clicking links |
| Browser storage | Free, yet survives reloads | Storage keys may differ between apps in the same project |
| Database | **Must be built and cleaned explicitly** | See below |

Confusing these three produces opposite failures: building elaborate cleanup for something that
self-cleans, or building none for something that persists forever.

### For database state

**Every test creates its own data** and never touches shared seed data. Three reasons:

1. Seed data is the **invariant witness** for asserting "other records did not change". If tests
   mutate it, the reference point is gone.
2. It is not restorable — auto-increment keys are never reused, so deleting and recreating yields a
   different key and everything referencing the old key breaks.
3. Running several browsers sequentially against one database: if the first run corrupts the seed,
   the later runs execute against different preconditions and fail for unrelated reasons.

**Build preconditions through the API, not through the UI.** Building them through the UI means a
defect in the Create flow turns every Update and Delete case red, destroying attribution.

**Name owned data with an ownership prefix, placed at the START.** If the system silently truncates
the value, the lost part is the tail and the ownership marker survives — the cleaner can still find
the record.

**Run the sweeper at the START of a run, not at the end.** The most dangerous leak happens when the
process is killed mid-run, and every end-of-run mechanism fails to execute then. A start-of-run
sweep cleans the previous run's leftovers — and it is the only step guaranteed to execute.

**The sweeper filters by owned prefix, never by key range.** Filtering by key range deletes other
people's data.

**Correctness must not depend on cleanup succeeding.** Leftover data carries a unique identifier, so
it cannot collide with the next run's uniqueness constraints, and it cannot contribute to any count
for records created later. Cleanup is hygiene, not a correctness condition — hold that boundary.

### The design-check question

Before writing any code, answer: **run the suite twice in a row against the same database — which
cases produce different results between run 1 and run 2?**

If that question has no answer, nothing written afterwards is trustworthy. And note: running three
browsers in one command is **already three passes** over the same database — a suite of this kind
breaks on its very first invocation.
