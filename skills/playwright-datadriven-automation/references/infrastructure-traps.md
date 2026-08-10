# Infrastructure traps

Failures unrelated to script quality that cost the most time, because their symptoms look exactly
like script defects or system defects.

---

## 1. `localhost` resolving to IPv6 while the server listens on IPv4

**Symptom:** `connect ECONNREFUSED ::1:3000` — note `::1`, an IPv6 address. Every test fails even
though the server is running normally and opens fine in a browser.

**Mechanism:** on some operating systems `localhost` resolves to IPv6 first. Many development
servers listen only on IPv4. The two never meet.

**The reverse also happens:** some modern build tools deliberately disable DNS result reordering and
bind to IPv6, while the test process takes the IPv4 path.

**How to recognise it:** issue a plain HTTP check against each address and compare results for
`localhost`, `127.0.0.1` and `[::1]`. Three different answers means this trap.

**Handling:** force everything to IPv4 — both the test configuration and the server start commands.
Document it in the run instructions, because the next person will hit it too.

---

## 2. Video recording crashes the browser

**Symptom:** `Target page, context or browser has been closed` occurring randomly, on one engine
only, at unremarkable points. Retries sometimes pass.

**Mechanism:** the recording layer in some bundled browser builds is unstable on some operating
systems.

**Handling:** disable video **for that project only**, keeping traces and screenshots so failure
evidence is not lost. Record the reason in a comment at the point of disabling.

---

## 3. Auto fixtures depending on `page`

**Symptom:** **API-only** tests (which never touch a browser) suddenly become much slower and
occasionally crash during context creation.

**Mechanism:** a fixture declared as automatic and depending on `page` forces the test framework to
start a browser for **every** test, including those that only call APIs.

**Handling:** instead of an automatic fixture, **override the `page` fixture itself**. Fixtures are
lazy, so tests that never request `page` never start a browser, while tests that do still get the
behaviour applied.

**Early warning sign:** compare API-only test durations before and after adding the fixture. Going
from tens of milliseconds to seconds is unmistakable.

---

## 4. Resources loaded from the public internet

**Symptom:** slow tests, occasional flakiness, and total failure when offline.

**Mechanism:** seed data points images or other assets at external addresses. Every page load fires
that many outbound requests — entirely outside the scope of testing.

**Handling:** intercept at the network layer and **fulfil with valid content** rather than aborting.
Aborting triggers the element's error path and can break display assertions. Fulfilling means the
element still loads successfully.

**Transparency:** attach the list of intercepted addresses to the report. This is an intervention in
the runtime environment and the reader is entitled to know.

---

## 5. The framework refuses the action before the system gets a say

**Symptom:** errors like "cannot type text into a number input" — raised by the **framework**, not
by the system rejecting the value.

**Three-step handling:**
1. Attempt the ordinary operation, catch the error, record the **verbatim** message in an annotation
2. Retry by simulating real keystrokes
3. **Read back the actual value** left in the field and feed that into the oracle

**Boundary:** whether the framework throws is **not** an assertion — it is tool behaviour, not
specification behaviour. The specification-derived expectation lives in the value read back.

---

## 6. Development servers dying quietly

**Symptom:** every test fails with connection errors, after everything worked moments earlier.

**Mechanism:** the server process stops when the machine sleeps, when a terminal is closed by
mistake, or when a window is dismissed accidentally.

**Handling:** this is precisely why the smoke suite exists. Running smoke before the full suite
separates "environment broken" from "script broken" in seconds instead of minutes.

Include this in the environment-limitations section of the report — it explains why the smoke suite
exists and shows it is not ceremonial.

---

## 7. Cleanup killing the whole run

**Symptom:** no tests run at all; the failure originates in the setup phase.

**Mechanism:** the start-of-run sweeper calls an API; if the API is not ready and the sweeper
throws, the entire run dies with it — including the smoke suite that exists to diagnose exactly that
situation.

**Handling:** the sweeper **must not throw**. On API failure it logs a warning and returns normally.
It is hygiene, not a precondition of the run.
