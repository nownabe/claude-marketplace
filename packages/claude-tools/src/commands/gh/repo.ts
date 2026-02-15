export interface RunCommandFn {
  (args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

export async function runGh(
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

export async function resolveRepo(
  runCommand: RunCommandFn = runGh,
): Promise<{ owner: string; repo: string }> {
  const result = await runCommand([
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner",
  ]);

  if (result.exitCode !== 0) {
    console.error(`Failed to detect repository: ${result.stderr}`);
    process.exit(1);
  }

  const [owner, repo] = result.stdout.split("/");
  if (!owner || !repo) {
    console.error(`Unexpected repository format: ${result.stdout}`);
    process.exit(1);
  }

  return { owner, repo };
}

export function parseRepoFlag(args: string[]): {
  remaining: string[];
  owner?: string;
  repo?: string;
} {
  const repoIndex = args.indexOf("--repo");
  if (repoIndex === -1) {
    return { remaining: args };
  }

  const repoValue = args[repoIndex + 1];
  if (!repoValue) {
    console.error("--repo requires a value in the format <owner/repo>");
    process.exit(1);
  }

  const [owner, repo] = repoValue.split("/");
  if (!owner || !repo) {
    console.error("--repo value must be in the format <owner/repo>");
    process.exit(1);
  }

  const remaining = [...args.slice(0, repoIndex), ...args.slice(repoIndex + 2)];
  return { remaining, owner, repo };
}
