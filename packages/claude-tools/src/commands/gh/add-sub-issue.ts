export interface AddSubIssueOptions {
  owner: string;
  repo: string;
  parentIssueNumber: number;
  subIssueNumber: number;
}

interface RunCommandFn {
  (args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

async function runGh(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["gh", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

export async function addSubIssue(
  options: AddSubIssueOptions,
  runCommand: RunCommandFn = runGh,
): Promise<void> {
  const { owner, repo, parentIssueNumber, subIssueNumber } = options;

  const idResult = await runCommand([
    "api",
    `repos/${owner}/${repo}/issues/${subIssueNumber}`,
    "--jq",
    ".id",
  ]);

  if (idResult.exitCode !== 0) {
    console.error(`Failed to get issue #${subIssueNumber}: ${idResult.stderr}`);
    process.exit(1);
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
    process.exit(1);
  }

  console.log(`Added #${subIssueNumber} as sub-issue of #${parentIssueNumber}`);
}

export async function main(): Promise<void> {
  const [owner, repo, parentStr, subStr] = process.argv.slice(4);

  if (!owner || !repo || !parentStr || !subStr) {
    console.error(
      "Usage: claude-tools gh add-sub-issue <owner> <repo> <parent_issue_number> <sub_issue_number>",
    );
    process.exit(1);
  }

  const parentIssueNumber = Number(parentStr);
  const subIssueNumber = Number(subStr);

  if (Number.isNaN(parentIssueNumber) || Number.isNaN(subIssueNumber)) {
    console.error("Issue numbers must be valid integers");
    process.exit(1);
  }

  await addSubIssue({ owner, repo, parentIssueNumber, subIssueNumber });
}
