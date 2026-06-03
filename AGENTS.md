# AGENTS.md

Guidance for AI agents working in this repository.

## Project status

**DataPIPE** (GitHub remote: [Afritrade](https://github.com/BassilekinJean/Afritrade)) is a greenfield repository. As of the initial environment setup, the tree contains only `README.md` — no application source, dependency manifests, Docker/Compose files, or CI configuration.

Do not assume a language, framework, or service topology until those files exist in the repo.

## Cursor Cloud specific instructions

### Automatic dependency refresh (update script)

The VM update script is intentionally a no-op (`true`) until the project adds dependency manifests (for example `package.json`, `pyproject.toml`, `requirements.txt`, or a `Makefile` with install targets). After manifests land, change the update script to the appropriate install command only — do not add service startup, migrations, or test/build steps to the update script.

### Services

| Service | Required? | Notes |
|---------|-----------|--------|
| *(none)* | — | No runnable services are defined in this repository yet. |

When application code is added, document required vs optional services here (API, workers, database, queues, etc.) and how to start them for local development.

### Lint / test / build / run

Not applicable until tooling is added. Once present, prefer documenting commands in `README.md` and link to them from this section rather than duplicating long command lists.

### VM tooling available

Cloud agent VMs in this environment typically include **Node.js** (v22.x), **npm**, **Python 3.12**, and **git**. Docker is not guaranteed unless installed for a specific task; do not assume `docker compose` without checking.

### Git workflow

- Default branch: `main`
- Feature branches for agent work: `cursor/<descriptive-name>-a162`
- Push: `git push -u origin <branch-name>`

### Secrets and environment variables

None are documented or required for the current README-only tree. When `.env.example` or similar is added, list required variables here with non-obvious setup notes only.
