import { describe, it, expect, mock } from "bun:test";
import { listSubIssues } from "./list-sub-issues";

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

describe("listSubIssues", () => {
  it("should call gh api with correct endpoint and output result", async () => {
    const subIssuesJson = JSON.stringify([
      { id: 1, number: 10, title: "Sub-issue 1" },
      { id: 2, number: 11, title: "Sub-issue 2" },
    ]);
    const { fn, calls } = createMockRunner([{ stdout: subIssuesJson, stderr: "", exitCode: 0 }]);

    await listSubIssues({ owner: "myorg", repo: "myrepo", issueNumber: 5 }, fn);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["api", "repos/myorg/myrepo/issues/5/sub_issues"]);
  });

  it("should exit with error when API call fails", async () => {
    const { fn } = createMockRunner([{ stdout: "", stderr: "Not Found", exitCode: 1 }]);

    const mockExit = mock(() => {
      throw new Error("process.exit");
    });
    const originalExit = process.exit;
    process.exit = mockExit as unknown as typeof process.exit;

    try {
      await listSubIssues({ owner: "myorg", repo: "myrepo", issueNumber: 999 }, fn);
    } catch {
      // expected
    }

    expect(mockExit).toHaveBeenCalledWith(1);
    process.exit = originalExit;
  });
});
