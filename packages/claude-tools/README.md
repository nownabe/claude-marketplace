# @nownabe/claude-tools

A collection of CLI tools for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) workflows. Provides GitHub-related utilities via the `gh` command group.

## Installation

```bash
npm install -g @nownabe/claude-tools
```

## Commands

### `gh add-sub-issues`

Add sub-issues to a parent GitHub issue.

```bash
claude-tools gh add-sub-issues <parent_issue_number> <sub_issue_number>... [--repo <owner/repo>]
```

**Example:**

```bash
claude-tools gh add-sub-issues 1 2 3 4
claude-tools gh add-sub-issues 1 2 3 --repo myorg/myrepo
```

### `gh list-sub-issues`

List sub-issues of a GitHub issue.

```bash
claude-tools gh list-sub-issues <issue_number> [--repo <owner/repo>]
```

**Example:**

```bash
claude-tools gh list-sub-issues 1
claude-tools gh list-sub-issues 1 --repo myorg/myrepo
```

### `gh resolve-tag-sha`

Resolve a GitHub repository tag to its commit SHA. Handles both lightweight and annotated tags.

```bash
claude-tools gh resolve-tag-sha <owner/repo> <tag>
```

**Example:**

```bash
$ claude-tools gh resolve-tag-sha actions/setup-node v4.4.0
actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0

$ claude-tools gh resolve-tag-sha dorny/paths-filter v3.0.2
dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36 # v3.0.2
```

## Prerequisites

- [GitHub CLI (`gh`)](https://cli.github.com/) must be installed and authenticated
- For `add-sub-issues` and `list-sub-issues`, the `--repo` flag is optional — if omitted, the repository is detected from the current working directory
