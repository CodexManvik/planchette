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
