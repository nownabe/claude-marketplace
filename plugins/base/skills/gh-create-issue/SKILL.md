---
name: gh-create-issue
description: Create a GitHub issue using the gh CLI. Use when the user wants to file a new issue, report a bug, request a feature, or create a task on GitHub. Handles issue body composition, duplicate checking, and sub-issue linking.
---

Create a GitHub issue using `gh issue create`. Always assign to `nownabe`.

## Inputs

- **Title** (required)
- **Body content** (required) — used to fill the template below
- **Labels** (optional)
- **Milestone** (optional)
- **Parent issue number** (optional) — set as parent (sub-issue)

## Issue body template

Compose the issue body using this template exactly. Fill in each section from the user's input.

```markdown
## Overview

<!-- A concise summary of the issue. -->

## Goal

<!-- The purpose and success criteria. What should be achieved and how will completion be measured? -->

## Context

<!-- Background information, current state, and any related decisions or discussions. -->

## Expected Impact

<!-- The expected outcomes and benefits of resolving this issue. -->

## Acceptance Criteria

- [ ] <!-- Specific, verifiable condition -->

## References

<!-- Links to related documents, PRs, discussions, or external resources. -->

## Implementation ideas

<!-- Initial ideas on how this could be implemented. -->

> **Note**: These are preliminary thoughts at issue creation time and have not been thoroughly considered from an implementation perspective. During design, revisit the goal and re-evaluate the approach from scratch.
```

## Procedure

1. Gather title, body content, and optional inputs from the user.

2. Search for duplicates and related issues with `gh issue list -s open -S "<keywords>"`.
   - If a potential duplicate exists, inform the user and ask how to proceed.
   - If related issues exist, suggest parent-child relationships to the user.

3. Compose the issue body using the template above.

4. Create the issue:

   ```sh
   gh issue create --title "<title>" --body "<body>" --assignee "nownabe" [--label "<label>"] [--milestone "<milestone>"]
   ```

5. If a parent issue is applicable, verify it is open and link via the REST API:

   ```sh
   SUB_ISSUE_ID=$(gh api "repos/{owner}/{repo}/issues/<number>" --jq '.id')
   gh api "repos/{owner}/{repo}/issues/<parent-number>/sub_issues" -X POST -f "sub_issue_id=$SUB_ISSUE_ID"
   ```

6. Return the created issue URL to the user.
