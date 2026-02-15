import { describe, it, expect, mock } from "bun:test";
import { resolveRepo, parseRepoFlag } from "./repo";

function createMockRunner(response: { stdout: string; stderr: string; exitCode: number }) {
  const calls: string[][] = [];
  const fn = mock(async (args: string[]) => {
    calls.push(args);
    return response;
  });
  return { fn, calls };
}

describe("resolveRepo", () => {
  it("should resolve owner and repo from gh repo view", async () => {
    const { fn, calls } = createMockRunner({ stdout: "myorg/myrepo", stderr: "", exitCode: 0 });

    const result = await resolveRepo(fn);

    expect(result).toEqual({ owner: "myorg", repo: "myrepo" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  });

  it("should exit with error when gh repo view fails", async () => {
    const { fn } = createMockRunner({
      stdout: "",
      stderr: "not a git repository",
      exitCode: 1,
    });

    const mockExit = mock(() => {
      throw new Error("process.exit");
    });
    const originalExit = process.exit;
    process.exit = mockExit as unknown as typeof process.exit;

    try {
      await resolveRepo(fn);
    } catch {
      // expected
    }

    expect(mockExit).toHaveBeenCalledWith(1);
    process.exit = originalExit;
  });
});

describe("parseRepoFlag", () => {
  it("should return remaining args when no --repo flag", () => {
    const result = parseRepoFlag(["1", "2", "3"]);
    expect(result).toEqual({ remaining: ["1", "2", "3"] });
  });

  it("should parse --repo flag and return owner/repo", () => {
    const result = parseRepoFlag(["1", "2", "--repo", "myorg/myrepo"]);
    expect(result).toEqual({ remaining: ["1", "2"], owner: "myorg", repo: "myrepo" });
  });

  it("should handle --repo flag at the beginning", () => {
    const result = parseRepoFlag(["--repo", "myorg/myrepo", "1", "2"]);
    expect(result).toEqual({ remaining: ["1", "2"], owner: "myorg", repo: "myrepo" });
  });

  it("should exit with error when --repo has no value", () => {
    const mockExit = mock(() => {
      throw new Error("process.exit");
    });
    const originalExit = process.exit;
    process.exit = mockExit as unknown as typeof process.exit;

    try {
      parseRepoFlag(["1", "--repo"]);
    } catch {
      // expected
    }

    expect(mockExit).toHaveBeenCalledWith(1);
    process.exit = originalExit;
  });

  it("should exit with error when --repo value is invalid", () => {
    const mockExit = mock(() => {
      throw new Error("process.exit");
    });
    const originalExit = process.exit;
    process.exit = mockExit as unknown as typeof process.exit;

    try {
      parseRepoFlag(["1", "--repo", "invalid"]);
    } catch {
      // expected
    }

    expect(mockExit).toHaveBeenCalledWith(1);
    process.exit = originalExit;
  });
});
