# Local Agent Entry Point

This file and all agent documentation are local-only. Never add them to Git.

## Start

1. Explicitly try to load skill `caveman`.
2. Read `.agent-local/README.md`.
3. Identify the affected module or stack area.
4. Read only the matching local `AGENTS.md` and files named by the router.
5. Inspect existing code and current worktree before editing.

## Work

- Make the smallest correct end-to-end change.
- Preserve user and concurrent-agent changes.
- Ask only when ambiguity changes externally visible behavior.
- Treat every child application as an independent Git submodule.
- Do not move submodule pointers, regenerate broad outputs, commit, or push unless requested.
- Keep durable discoveries in `.agent-local/project-memory.md`; do not store chat transcripts.

## Engineering Quality

- Apply SOLID and Clean Code pragmatically; do not introduce abstractions only to satisfy a principle.
- Keep responsibilities cohesive, dependencies explicit, and module boundaries intact.
- Prefer clear names, focused functions, simple control flow, and explicit error handling.
- Remove duplication when it represents stable shared knowledge; do not generalize from a single use case.
- Follow existing architecture and patterns unless current code provides concrete evidence that they should change.
- Avoid speculative abstractions, dead code, unrelated refactors, and premature optimization.
- Add or update focused tests when externally observable behavior changes.

## Verification

- Never run commands whose purpose is `test` or `build`; they are too slow in this workspace.
- Run narrow inspection, syntax, formatting, or static checks when safe.
- Give the user exact test/build commands to run, with working directory and expected result.
- Read changed documentation end to end before finishing.

## Environment

- Host is Windows; agents usually run through Linux/WSL.
- The user runs commands from Windows PowerShell; agents normally run from Linux under WSL.
- Give user-run commands in PowerShell-compatible syntax and agent-run commands in Linux shell syntax.
- When handing off commands, include the Windows path for PowerShell and do not expose WSL-only paths unless explicitly requested.
- Quote paths and account for Windows/Linux path and line-ending differences.
- `.agent-local/verification.md` is canonical when command classification is unclear.
