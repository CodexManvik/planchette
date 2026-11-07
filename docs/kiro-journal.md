# Kiro journal

Notes for the Kiro write-up. Keep them true and specific.

## How this project is built

- Kiro writes the application code.
- Claude Code handled early research and design, drives Kiro CLI, reviews its output, and runs the checks.
- Manvik makes the product decisions and owns the submission.

## 2026-11-07

- Kiro IDE (Haiku 4.5) drafted the five steering files and scaffolded the project.
- Claude Code reviewed the result and found steering errors, including a sans-serif rule that contradicted the approved Parlour design and wrong follow-ups in `product.md`. Kiro fixed them from a correction prompt.
- Claude Code wrote the two hook files, `run-tests.json` and `check-build.json`, using the format in Kiro 1.4.121.
- Kiro CLI 3.1.0 was installed so Claude Code can run Kiro directly. Unattended runs use limited file tools instead of `--trust-all-tools`.
- The `check-build` hook fired during a Kiro CLI run. A failed file edit also taught us to verify results: Kiro's model invented a "write hook" to explain the failure, and no such hook existed.
- Kiro CLI (Haiku 4.5) drafted the `sweep-logic` requirements in about 0.4 credits. Review found logic bugs before any code existed:
  - Joining fragments with ". " garbled messages such as "Pain in my. chest."
  - "I NEE" plus the suggestion "need" became "I NEEneed ".
  - Late AI suggestions shifted the options, so a select could land on the wrong one.
  - Cancelling a need sent the patient to the alphabet layer.
  - The rest timer counted ticks, not sweeps.
  - Back had no way to know the previous node.
- Kiro corrected the document from a numbered fix list for about 1.9 credits. The shared interfaces gained `path`, `held.source` and `forDraft`.
- Kiro CLI (Sonnet 4.5) wrote `design.md` and `tasks.md` for about 2.4 credits. Review found five issues, fixed by Kiro (Haiku 4.5):
  - Back couldn't tell whether to remove a fragment.
  - The Pain location node showed "Back" twice.
  - Waking from rest didn't reset the node.
  - Spoken text wasn't trimmed.
  - A false claim about suggestions during hold.
- Kiro CLI (Haiku 4.5) implemented the state machine and 40 unit tests. They typechecked and passed on the first run, and review found no logic bugs.
- Kiro's first property tests passed, but most of them couldn't fail:
  - P1 only asserted that something was visited.
  - Every `forDraft` was a random string, so suggestion events were almost always ignored.
  - P2 and P3 set `index` directly instead of reaching states through `next()`.
  - A `'holdkey'` typo made one branch dead.
- Kiro (Sonnet 4.5) rewrote them from a detailed brief. The rewrite then failed twice, both times from test bugs rather than logic bugs: a search bounded by states visited instead of depth, and a greedy walk in place of a real search. Kiro fixed both.
- Kiro (Sonnet 4.5) added P9, which starts from every reachable alphabet state and checks that a late suggestion never moves the patient's select to a different option.
- Mutation check by Claude Code: six realistic bugs were planted one at a time in `sweep.ts`, and all six made tests fail. P9 is the only test that catches a lost control highlight. An earlier run looked like a miss, but the harness hadn't planted that bug because of Windows line endings.
- Total for the sweep-logic spec: about 14 credits.
