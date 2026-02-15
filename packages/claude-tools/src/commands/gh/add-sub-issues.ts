import { type RunCommandFn, runGh, resolveRepo, parseRepoFlag } from "./repo";

export interface AddSubIssuesOptions {
  owner: string;
  repo: string;
  parentIssueNumber: number;
  subIssueNumbers: number[];
}

export async function addSubIssues(
  options: AddSubIssuesOptions,
  runCommand: RunCommandFn = runGh,
): Promise<void> {
  const { owner, repo, parentIssueNumber, subIssueNumbers } = options;

  let hasError = false;

  for (const subIssueNumber of subIssueNumbers) {
    const idResult = await runCommand([
      "api",
      `repos/${owner}/${repo}/issues/${subIssueNumber}`,
      "--jq",
      ".id",
    ]);

    if (idResult.exitCode !== 0) {
      console.error(`Failed to get issue #${subIssueNumber}: ${idResult.stderr}`);
      hasError = true;
      continue;
    }

    const subIssueId = idResult.stdout;

    const addResult = await runCommand([
      "api",
      `repos/${owner}/${repo}/issues/${parentIssueNumber}/sub_issues`,
      "--method",
      "POST",
      "--field",
      `sub_issue_id=${subIssueId}`,
    ]);

    if (addResult.exitCode !== 0) {
      console.error(
        `Failed to add sub-issue #${subIssueNumber} to #${parentIssueNumber}: ${addResult.stderr}`,
      );
      hasError = true;
      continue;
    }

    console.log(`Added #${subIssueNumber} as sub-issue of #${parentIssueNumber}`);
  }

  if (hasError) {
    process.exit(1);
  }
}

export async function main(): Promise<void> {
  const {
    remaining: allArgs,
    owner: flagOwner,
    repo: flagRepo,
  } = parseRepoFlag(process.argv.slice(2));
  // allArgs[0] = group ("gh"), allArgs[1] = command ("add-sub-issues"), rest = positional args
  const remaining = allArgs.slice(2);

  if (remaining.length < 2) {
    console.error(
      "Usage: claude-tools gh add-sub-issues <parent_issue_number> <sub_issue_number>... [--repo <owner/repo>]",
    );
    process.exit(1);
  }

  const [parentStr, ...subStrs] = remaining;

  const parentIssueNumber = Number(parentStr);
  if (Number.isNaN(parentIssueNumber)) {
    console.error("Parent issue number must be a valid integer");
    process.exit(1);
  }

  const subIssueNumbers = subStrs.map(Number);
  if (subIssueNumbers.some(Number.isNaN)) {
    console.error("Sub-issue numbers must be valid integers");
    process.exit(1);
  }

  let owner: string;
  let repo: string;
  if (flagOwner && flagRepo) {
    owner = flagOwner;
    repo = flagRepo;
  } else {
    const resolved = await resolveRepo();
    owner = resolved.owner;
    repo = resolved.repo;
  }

  await addSubIssues({ owner, repo, parentIssueNumber, subIssueNumbers });
}
