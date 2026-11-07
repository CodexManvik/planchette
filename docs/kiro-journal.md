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
