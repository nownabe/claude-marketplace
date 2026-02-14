# Contributing

## Overview

This repository is a monorepo managed with [bun workspaces](https://bun.sh/docs/install/workspaces) and [Changesets](https://github.com/changesets/changesets).

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@nownabe/claude-tools` | `packages/claude-tools` | Claude Code tools |
| `@nownabe/claude-hooks` | `packages/claude-hooks` | Claude Code hooks |

## Prerequisites

- [Bun](https://bun.sh/) (latest)

## Development

### Install dependencies

```sh
bun install
```

### Build all packages

```sh
bun run build
```

### Run tests

```sh
bun run test
```

### Lint

```sh
bun run lint
```

### Adding a changeset

When making changes that should be published, create a changeset:

```sh
bun run changeset
```

Follow the prompts to describe your changes and select the appropriate version bump.
