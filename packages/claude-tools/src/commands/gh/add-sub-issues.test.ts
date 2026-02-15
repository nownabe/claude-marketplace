import { describe, it, expect, mock } from "bun:test";
import { addSubIssues } from "./add-sub-issues";

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

describe("addSubIssues", () => {
  it("should add a single sub-issue", async () => {
    const { fn, calls } = createMockRunner([
      { stdout: "12345", stderr: "", exitCode: 0 },
      { stdout: '{"id": 1}', stderr: "", exitCode: 0 },
    ]);

    await addSubIssues(
      {
        owner: "myorg",
        repo: "myrepo",
        parentIssueNumber: 1,
        subIssueNumbers: [2],
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

  it("should add multiple sub-issues", async () => {
    const { fn, calls } = createMockRunner([
      { stdout: "11111", stderr: "", exitCode: 0 },
      { stdout: '{"id": 1}', stderr: "", exitCode: 0 },
      { stdout: "22222", stderr: "", exitCode: 0 },
      { stdout: '{"id": 2}', stderr: "", exitCode: 0 },
      { stdout: "33333", stderr: "", exitCode: 0 },
      { stdout: '{"id": 3}', stderr: "", exitCode: 0 },
    ]);

    await addSubIssues(
      {
        owner: "myorg",
        repo: "myrepo",
        parentIssueNumber: 1,
        subIssueNumbers: [2, 3, 4],
      },
      fn,
    );

    expect(calls).toHaveLength(6);
    expect(calls[0]).toEqual(["api", "repos/myorg/myrepo/issues/2", "--jq", ".id"]);
    expect(calls[1]).toEqual([
      "api",
      "repos/myorg/myrepo/issues/1/sub_issues",
      "--method",
      "POST",
      "--field",
      "sub_issue_id=11111",
    ]);
    expect(calls[2]).toEqual(["api", "repos/myorg/myrepo/issues/3", "--jq", ".id"]);
    expect(calls[3]).toEqual([
      "api",
      "repos/myorg/myrepo/issues/1/sub_issues",
      "--method",
      "POST",
      "--field",
      "sub_issue_id=22222",
    ]);
    expect(calls[4]).toEqual(["api", "repos/myorg/myrepo/issues/4", "--jq", ".id"]);
    expect(calls[5]).toEqual([
      "api",
      "repos/myorg/myrepo/issues/1/sub_issues",
      "--method",
      "POST",
      "--field",
      "sub_issue_id=33333",
    ]);
  });

  it("should continue processing when one sub-issue fails to fetch", async () => {
    const { fn, calls } = createMockRunner([
      { stdout: "", stderr: "Not Found", exitCode: 1 },
      { stdout: "22222", stderr: "", exitCode: 0 },
      { stdout: '{"id": 2}', stderr: "", exitCode: 0 },
    ]);

    const mockExit = mock(() => {
      throw new Error("process.exit");
    });
    const originalExit = process.exit;
    process.exit = mockExit as unknown as typeof process.exit;

    try {
      await addSubIssues(
        {
          owner: "myorg",
          repo: "myrepo",
          parentIssueNumber: 1,
          subIssueNumbers: [999, 3],
        },
        fn,
      );
    } catch {
      // expected
    }

    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual(["api", "repos/myorg/myrepo/issues/999", "--jq", ".id"]);
    expect(calls[1]).toEqual(["api", "repos/myorg/myrepo/issues/3", "--jq", ".id"]);
    expect(calls[2]).toEqual([
      "api",
      "repos/myorg/myrepo/issues/1/sub_issues",
      "--method",
      "POST",
      "--field",
      "sub_issue_id=22222",
    ]);
    expect(mockExit).toHaveBeenCalledWith(1);
    process.exit = originalExit;
  });

  it("should continue processing when adding a sub-issue fails", async () => {
    const { fn, calls } = createMockRunner([
      { stdout: "11111", stderr: "", exitCode: 0 },
      { stdout: "", stderr: "Forbidden", exitCode: 1 },
      { stdout: "22222", stderr: "", exitCode: 0 },
      { stdout: '{"id": 2}', stderr: "", exitCode: 0 },
    ]);

    const mockExit = mock(() => {
      throw new Error("process.exit");
    });
    const originalExit = process.exit;
    process.exit = mockExit as unknown as typeof process.exit;

    try {
      await addSubIssues(
        {
          owner: "myorg",
          repo: "myrepo",
          parentIssueNumber: 1,
          subIssueNumbers: [2, 3],
        },
        fn,
      );
    } catch {
      // expected
    }

    expect(calls).toHaveLength(4);
    expect(mockExit).toHaveBeenCalledWith(1);
    process.exit = originalExit;
  });

  it("should exit with error when fetching sub-issue ID fails for single issue", async () => {
    const { fn } = createMockRunner([{ stdout: "", stderr: "Not Found", exitCode: 1 }]);

    const mockExit = mock(() => {
      throw new Error("process.exit");
    });
    const originalExit = process.exit;
    process.exit = mockExit as unknown as typeof process.exit;

    try {
      await addSubIssues(
        {
          owner: "myorg",
          repo: "myrepo",
          parentIssueNumber: 1,
          subIssueNumbers: [999],
        },
        fn,
      );
    } catch {
      // expected
    }

    expect(mockExit).toHaveBeenCalledWith(1);
    process.exit = originalExit;
  });

  it("should exit with error when adding sub-issue fails for single issue", async () => {
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
      await addSubIssues(
        {
          owner: "myorg",
          repo: "myrepo",
          parentIssueNumber: 1,
          subIssueNumbers: [2],
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
