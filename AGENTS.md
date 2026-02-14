# AGENTS.md

This repository is a Claude Code plugin marketplace.

## Project Structure

```
.claude-plugin/
  marketplace.json   # Marketplace manifest listing all plugins
plugins/
  <plugin-name>/
    .claude-plugin/
      plugin.json    # Plugin manifest (name, description, version, etc.)
    skills/
      <skill-name>/
        SKILL.md     # Skill definition with YAML frontmatter + instructions
```

## Conventions

- **Commit messages**: Use [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat:`, `fix:`, `docs:`, `chore:`)
- **Branching**: Create a feature branch from `main` for each change, then open a pull request
- **Language**: Write all user-facing content (README, PR descriptions, etc.) in English

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
