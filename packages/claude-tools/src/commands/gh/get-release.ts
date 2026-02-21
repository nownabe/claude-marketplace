import { type RunCommandFn, runGh, resolveRepo, parseRepoFlag } from "./repo";

export interface GetReleaseOptions {
  repo: string;
  tag?: string;
  jq?: string;
}

export async function getRelease(
  options: GetReleaseOptions,
  runCommand: RunCommandFn = runGh,
): Promise<string> {
  const { repo, tag, jq = "." } = options;

  const endpoint = tag ? `repos/${repo}/releases/tags/${tag}` : `repos/${repo}/releases/latest`;

  const result = await runCommand(["api", endpoint, "--jq", jq]);

  if (result.exitCode !== 0) {
    const target = tag ? `tag "${tag}"` : "latest release";
    console.error(`Failed to get ${target} for ${repo}: ${result.stderr}`);
    process.exit(1);
  }

  return result.stdout;
}

export async function main(): Promise<void> {
  const {
    remaining: allArgs,
    owner: flagOwner,
    repo: flagRepo,
  } = parseRepoFlag(process.argv.slice(2));
  // allArgs[0] = group ("gh"), allArgs[1] = command ("get-release"), rest = flags
  const remaining = allArgs.slice(2);

  let tag: string | undefined;
  let jq: string | undefined;

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i] === "--tag") {
      tag = remaining[i + 1];
      if (!tag) {
        console.error("--tag requires a value");
        process.exit(1);
      }
      i++;
    } else if (remaining[i] === "--jq") {
      jq = remaining[i + 1];
      if (!jq) {
        console.error("--jq requires a value");
        process.exit(1);
      }
      i++;
    }
  }

  let repo: string;
  if (flagOwner && flagRepo) {
    repo = `${flagOwner}/${flagRepo}`;
  } else {
    const resolved = await resolveRepo();
    repo = `${resolved.owner}/${resolved.repo}`;
  }

  const output = await getRelease({ repo, tag, jq });
  console.log(output);
}
