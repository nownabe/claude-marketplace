# AGENTS.md

This repository is a Claude Code plugin marketplace.

## Project Structure

```
.claude-plugin/
  marketplace.json   # Marketplace manifest listing all plugins
packages/
  <package-name>/    # TypeScript packages (bun workspaces)
    src/
    tests/
    package.json
plugins/
  <plugin-name>/
    .claude-plugin/
      plugin.json    # Plugin manifest (name, description, version, etc.)
    skills/
      <skill-name>/
        SKILL.md     # Skill definition with YAML frontmatter + instructions
.github/
  workflows/         # GitHub Actions CI/CD workflows
```

## Conventions

- **Commit messages**: Use [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat:`, `fix:`, `docs:`, `chore:`)
- **Branching**: Create a feature branch from `main` for each change, then open a pull request
- **Language**: Write all user-facing content (README, PR descriptions, etc.) in English

## Workflow

- Work autonomously and create a pull request when done, then ask the user for review
- If design decisions are needed, present the design to the user for review **before** starting implementation
- When starting new work, always create a feature branch from the latest remote `main` (`git fetch origin && git switch -c <branch> origin/main`). Never branch from another feature branch to avoid including unrelated commits in the PR

## Pre-commit Checks

Run the appropriate checks before committing, depending on what was changed:

| Changed files                 | Command                           |
| ----------------------------- | --------------------------------- |
| `packages/**`                 | `bun run check`                   |
| `.github/**` (GitHub Actions) | `zizmor`, `actionlint`, `ghalint` |
| `*.md`, `*.json`              | `bun run format`                  |

## Changesets

When making changes to packages that affect released artifacts (feature additions, bug fixes, etc.), run:

```
bun run changeset
```

This is **not** needed for documentation-only or CI-only changes.

## Adding a Plugin

1. Create `plugins/<plugin-name>/.claude-plugin/plugin.json` with plugin metadata
2. Create `plugins/<plugin-name>/skills/<skill-name>/SKILL.md` with skill instructions
3. Add an entry to `.claude-plugin/marketplace.json` in the `plugins` array
4. Validate with `/plugin validate .`

## Validation

After any changes to marketplace or plugin manifests, run:

```
/plugin validate .
```

Ensure validation passes without errors before committing.
