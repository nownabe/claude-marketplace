# Release Flow

This project uses [Changesets](https://github.com/changesets/changesets) and [npm Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions) (OIDC) to automate package releases.

## Overview

```
Developer adds changeset → PR merged to main
                                ↓
                  changesets/action detects pending changesets
                                ↓
                  Creates/updates "Version Packages" PR
                  (bumps versions, updates CHANGELOGs)
                                ↓
                  Maintainer reviews & merges the PR
                                ↓
                  changesets/action detects no pending changesets
                                ↓
                  Publishes to npm (via OIDC) → creates GitHub Releases
```

## Adding a Changeset

When you make a change that should be released, add a changeset:

```sh
bun run changeset
```

This will prompt you to select the affected packages and the semver bump type (patch, minor, major). A markdown file will be created in `.changeset/` — commit it along with your changes.

## How It Works

The release workflow (`.github/workflows/release.yaml`) runs on every push to `main`:

1. **Pending changesets exist** — the workflow creates or updates a PR titled "chore: version packages". This PR bumps package versions and updates CHANGELOGs based on the accumulated changesets.
2. **No pending changesets** (i.e., the version PR was just merged) — the workflow publishes updated packages to npm and creates GitHub Releases.

Authentication to npm uses OIDC (Trusted Publishing), so no `NPM_TOKEN` secret is needed.

## Initial Setup for New Packages

Before a package can be published via Trusted Publishing, it must already exist on npm. For a new package:

1. Publish an initial version manually or with [`setup-npm-trusted-publish`](https://github.com/azu/setup-npm-trusted-publish):
   ```sh
   npx setup-npm-trusted-publish @nownabe/<package-name>
   ```
2. On npmjs.com, go to the package Settings → Trusted Publisher and configure:
   - Repository owner: `nownabe`
   - Repository name: `claude-marketplace`
   - Workflow filename: `release.yaml`
