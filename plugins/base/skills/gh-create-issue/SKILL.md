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

## Issue body template

The issue body MUST follow this template. Fill in each section based on the user's input.

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

- [ ] <!-- Specific, verifiable condition 1 -->
- [ ] <!-- Specific, verifiable condition 2 -->

## References

<!-- Links to related documents, PRs, discussions, or external resources. -->

## Implementation ideas

<!-- Initial ideas on how this could be implemented. -->

> **Note**: These are preliminary thoughts at issue creation time and have not been thoroughly considered from an implementation perspective. During design, revisit the goal and re-evaluate the approach from scratch.
```

## Instructions

1. Gather the title, body content, and any optional inputs from the user.

2. **Pre-creation checks**:
   - Search existing open issues (`gh issue list -s open -S "<keywords>"`) to verify there is no duplicate. If a potential duplicate is found, inform the user and ask how to proceed.
   - Search for related issues. If related issues exist, consider whether they should have a parent-child relationship with the new issue and suggest it to the user.

3. Compose the issue body using the template above.

4. Create the issue:
   ```sh
   gh issue create \
     --title "<title>" \
     --body "<body>" \
     [--label "<label>"] \
     [--assignee "<assignee>"] \
     [--milestone "<milestone>"]
   ```

5. **Set parent issue** (if applicable):
   - If a parent issue is specified or identified in step 2, verify it is **not closed** (`gh issue view <parent-number> --json state`).
   - If the parent issue is open, add the created issue as a sub-issue of the parent via the REST API:
     ```sh
     # Get the created issue's REST API ID (integer)
     SUB_ISSUE_ID=$(gh api "repos/{owner}/{repo}/issues/<number>" --jq '.id')
     # Add as sub-issue to the parent
     gh api "repos/{owner}/{repo}/issues/<parent-number>/sub_issues" \
       -X POST -f "sub_issue_id=$SUB_ISSUE_ID"
     ```

6. Return the URL of the created issue to the user.
