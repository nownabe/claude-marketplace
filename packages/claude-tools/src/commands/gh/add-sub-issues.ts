export interface AddSubIssuesOptions {
  owner: string;
  repo: string;
  parentIssueNumber: number;
  subIssueNumbers: number[];
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
  const args = process.argv.slice(4);

  if (args.length < 4) {
    console.error(
      "Usage: claude-tools gh add-sub-issues <owner> <repo> <parent_issue_number> <sub_issue_number>...",
    );
    process.exit(1);
  }

  const [owner, repo, parentStr, ...subStrs] = args;

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

  await addSubIssues({ owner, repo, parentIssueNumber, subIssueNumbers });
}
