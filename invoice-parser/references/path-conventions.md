# Path Conventions

Use these conventions to keep extraction deterministic and year-scoped.

## Inputs

- Finance root default: `<repo>/finance`
- Year root: `finance/<year>/`
- Document root: `finance/<year>/real_moves/`
- Supported input extensions: `.pdf`, `.jpg`, `.jpeg`, `.png`

## Outputs

- Readable root: `finance/<year>/real_moves/readable/`
- Sidecar path rule: keep the same relative path and replace extension with `.txt`
- Index files:
  - `finance/<year>/real_moves/readable/index.json`
  - `finance/<year>/real_moves/readable/index.csv`

## Exclusions

- Never treat files already under `/readable/` as inputs.
- Never overwrite source documents.
