import { describe, it, expect, mock } from "bun:test";
import { addSubIssue } from "./add-sub-issue";

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

describe("addSubIssue", () => {
  it("should get sub-issue ID and add it as sub-issue", async () => {
    const { fn, calls } = createMockRunner([
      { stdout: "12345", stderr: "", exitCode: 0 },
      { stdout: '{"id": 1}', stderr: "", exitCode: 0 },
    ]);

    await addSubIssue(
      {
        owner: "myorg",
        repo: "myrepo",
        parentIssueNumber: 1,
        subIssueNumber: 2,
      },
      fn,
    );

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(["api", "repos/myorg/myrepo/issues/2", "--jq", ".id"]);
    expect(calls[1]).toEqual([
      "api",
      "repos/myorg/myrepo/issues/1/sub_issues",
      "--method",
      "POST",
      "--field",
      "sub_issue_id=12345",
    ]);
  });

  it("should exit with error when fetching sub-issue ID fails", async () => {
    const { fn } = createMockRunner([{ stdout: "", stderr: "Not Found", exitCode: 1 }]);

    const mockExit = mock(() => {
      throw new Error("process.exit");
    });
    const originalExit = process.exit;
    process.exit = mockExit as unknown as typeof process.exit;

    try {
      await addSubIssue(
        {
          owner: "myorg",
          repo: "myrepo",
          parentIssueNumber: 1,
          subIssueNumber: 999,
        },
        fn,
      );
    } catch {
      // expected
    }

    expect(mockExit).toHaveBeenCalledWith(1);
    process.exit = originalExit;
  });

  it("should exit with error when adding sub-issue fails", async () => {
    const { fn } = createMockRunner([
      { stdout: "12345", stderr: "", exitCode: 0 },
      { stdout: "", stderr: "Forbidden", exitCode: 1 },
    ]);

    const mockExit = mock(() => {
      throw new Error("process.exit");
    });
    const originalExit = process.exit;
    process.exit = mockExit as unknown as typeof process.exit;

    try {
      await addSubIssue(
        {
          owner: "myorg",
          repo: "myrepo",
          parentIssueNumber: 1,
          subIssueNumber: 2,
        },
        fn,
      );
    } catch {
      // expected
    }

    expect(mockExit).toHaveBeenCalledWith(1);
    process.exit = originalExit;
  });
});
