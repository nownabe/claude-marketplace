---
name: gh-create-issue
description: Create a GitHub issue using the gh CLI
---

Create a GitHub issue using the `gh issue create` command.

## Required inputs

- **Title**: The issue title (required)
- **Body**: The issue description/body (required)

## Optional inputs

- **Labels**: One or more labels to apply
- **Assignees**: One or more users to assign
- **Milestone**: A milestone to associate with the issue
- **Parent issue**: A parent issue number to set as the parent (sub-issue)

## Issue body structure

The issue body MUST follow this structure:

### Overview

A concise summary of the issue.

### Goal

The purpose and success criteria. What should be achieved and how will completion be measured?

### Context

Background information, current state, and any related decisions or discussions.

### Expected Impact

The expected outcomes and benefits of resolving this issue.

### Acceptance Criteria

A checklist of specific, verifiable conditions that must be met.

### References

Links to related documents, PRs, discussions, or external resources.

### Implementation ideas

Initial ideas on how this could be implemented. Note: these are preliminary thoughts at issue creation time and have not been thoroughly considered from an implementation perspective. During design, revisit the goal and re-evaluate the approach from scratch.

## Pre-creation checks

Before creating the issue, perform the following checks:

1. **Duplicate check**: Search existing open issues (`gh issue list`) to verify there is no duplicate issue. If a potential duplicate is found, inform the user and ask how to proceed.
2. **Related issues**: Search for related issues. If related issues exist, consider whether they should have a parent-child relationship with the new issue.

## Sub-issues

If the user specifies a parent issue or you identify a suitable parent issue during the related issues check:

- Verify the parent issue is **not closed** (do not set a closed issue as the parent).
- After creating the issue, set the parent using `gh issue edit <number> --add-parent <parent-number>`.

## Instructions

1. Gather the title, body content, and any optional inputs from the user.
2. Perform the pre-creation checks (duplicate and related issues).
3. Compose the issue body following the structure above.
4. Run `gh issue create` with the provided arguments:
   - `--title "<title>"`
   - `--body "<body>"`
   - `--label "<label>"` for each label (if provided)
   - `--assignee "<assignee>"` for each assignee (if provided)
   - `--milestone "<milestone>"` if provided
5. If a parent issue is specified and it is open, run `gh issue edit <number> --add-parent <parent-number>`.
6. Return the URL of the created issue to the user.
