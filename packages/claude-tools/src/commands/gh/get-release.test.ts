import { describe, it, expect, mock } from "bun:test";
import { getRelease } from "./get-release";

function createMockRunner(responses: { stdout: string; stderr: string; exitCode: number }[]) {
  let callIndex = 0;
  const calls: string[][] = [];
  const fn = mock(async (args: string[]) => {
    calls.push(args);
    const response = responses[callIndex];
    callIndex++;
    return response;
  });
  return { fn, calls };
}

describe("getRelease", () => {
  it("should get the latest release with default jq", async () => {
    const { fn, calls } = createMockRunner([
      {
        stdout: JSON.stringify({ tag_name: "v1.0.0", name: "Release 1.0.0" }),
        stderr: "",
        exitCode: 0,
      },
    ]);

    const result = await getRelease({ repo: "owner/repo" }, fn);

    expect(result).toBe(JSON.stringify({ tag_name: "v1.0.0", name: "Release 1.0.0" }));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["api", "repos/owner/repo/releases/latest", "--jq", "."]);
  });

  it("should get the latest release with custom jq", async () => {
    const { fn, calls } = createMockRunner([
      {
        stdout: "v1.0.0",
        stderr: "",
        exitCode: 0,
      },
    ]);

    const result = await getRelease({ repo: "owner/repo", jq: ".tag_name" }, fn);

    expect(result).toBe("v1.0.0");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["api", "repos/owner/repo/releases/latest", "--jq", ".tag_name"]);
  });

  it("should get a release by tag", async () => {
    const { fn, calls } = createMockRunner([
      {
        stdout: JSON.stringify({ tag_name: "v2.0.0", body: "Release notes" }),
        stderr: "",
        exitCode: 0,
      },
    ]);

    const result = await getRelease({ repo: "myorg/myrepo", tag: "v2.0.0" }, fn);

    expect(result).toBe(JSON.stringify({ tag_name: "v2.0.0", body: "Release notes" }));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["api", "repos/myorg/myrepo/releases/tags/v2.0.0", "--jq", "."]);
  });

  it("should exit with error when the API call fails", async () => {
    const { fn } = createMockRunner([{ stdout: "", stderr: "Not Found", exitCode: 1 }]);

    const mockExit = mock(() => {
      throw new Error("process.exit");
    });
    const originalExit = process.exit;
    process.exit = mockExit as unknown as typeof process.exit;

    try {
      await getRelease({ repo: "owner/repo" }, fn);
    } catch {
      // expected
    }

    expect(mockExit).toHaveBeenCalledWith(1);
    process.exit = originalExit;
  });
});
