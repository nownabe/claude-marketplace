export interface ListSubIssuesOptions {
  owner: string;
  repo: string;
  issueNumber: number;
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

export async function listSubIssues(
  options: ListSubIssuesOptions,
  runCommand: RunCommandFn = runGh,
): Promise<void> {
  const { owner, repo, issueNumber } = options;

  const result = await runCommand([
    "api",
    `repos/${owner}/${repo}/issues/${issueNumber}/sub_issues`,
  ]);

  if (result.exitCode !== 0) {
    console.error(`Failed to list sub-issues for #${issueNumber}: ${result.stderr}`);
    process.exit(1);
  }

  console.log(result.stdout);
}

export async function main(): Promise<void> {
  const [owner, repo, issueStr] = process.argv.slice(4);

  if (!owner || !repo || !issueStr) {
    console.error("Usage: claude-tools gh list-sub-issues <owner> <repo> <issue_number>");
    process.exit(1);
  }

  const issueNumber = Number(issueStr);

  if (Number.isNaN(issueNumber)) {
    console.error("Issue number must be a valid integer");
    process.exit(1);
  }

  await listSubIssues({ owner, repo, issueNumber });
}
