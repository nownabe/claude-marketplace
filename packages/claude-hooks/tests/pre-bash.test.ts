import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import {
  collectAncestorDirs,
  loadForbiddenPatterns,
  checkForbiddenPatterns,
  type ActivePattern,
} from "../src/pre-bash";

describe("collectAncestorDirs", () => {
  test("returns single directory when start equals stop", () => {
    expect(collectAncestorDirs("/home/user", "/home/user")).toEqual(["/home/user"]);
  });

  test("returns path from start to stop", () => {
    expect(collectAncestorDirs("/home/user/projects/app", "/home/user")).toEqual([
      "/home/user/projects/app",
      "/home/user/projects",
      "/home/user",
    ]);
  });

  test("stops at filesystem root if stop is not an ancestor", () => {
    const result = collectAncestorDirs("/tmp/a", "/other");
    expect(result[0]).toBe("/tmp/a");
    expect(result[result.length - 1]).toBe("/");
  });
});

describe("checkForbiddenPatterns", () => {
  const patterns: ActivePattern[] = [
    {
      pattern: "\\bgit\\s+-C\\b",
      reason: "git -C is forbidden",
      suggestion: "Use cd instead",
    },
    {
      pattern: "\\brm\\s+-rf\\s+/\\b",
      reason: "rm -rf / is forbidden",
      suggestion: "Be more specific",
    },
  ];

  test("returns null when no patterns match", () => {
    expect(checkForbiddenPatterns("git status", patterns)).toBeNull();
  });

  test("returns deny result for matching pattern", () => {
    const result = checkForbiddenPatterns("git -C /tmp status", patterns);
    expect(result).toEqual({
      reason: "git -C is forbidden",
      suggestion: "Use cd instead",
    });
  });

  test("returns first matching pattern", () => {
    const result = checkForbiddenPatterns("git -C /tmp && rm -rf /", patterns);
    expect(result?.reason).toBe("git -C is forbidden");
  });

  test("returns null for empty patterns", () => {
    expect(checkForbiddenPatterns("git -C /tmp", [])).toBeNull();
  });
});

describe("loadForbiddenPatterns", () => {
  let tmpDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pre-bash-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tmpDir, { recursive: true });
  });

  function writeConfig(dir: string, config: object) {
    const claudeDir = join(dir, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, "pre-bash.json"), JSON.stringify(config));
  }

  test("returns empty array when no config files exist", () => {
    const cwd = join(tmpDir, "a", "b");
    mkdirSync(cwd, { recursive: true });
    expect(loadForbiddenPatterns(cwd)).toEqual([]);
  });

  test("loads patterns from HOME", () => {
    writeConfig(tmpDir, {
      forbiddenPatterns: [{ pattern: "\\bfoo\\b", reason: "no foo", suggestion: "use bar" }],
    });
    expect(loadForbiddenPatterns(tmpDir)).toEqual([
      { pattern: "\\bfoo\\b", reason: "no foo", suggestion: "use bar" },
    ]);
  });

  test("merges patterns from multiple levels", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(tmpDir, {
      forbiddenPatterns: [{ pattern: "\\bfoo\\b", reason: "no foo", suggestion: "use bar" }],
    });
    writeConfig(projectDir, {
      forbiddenPatterns: [{ pattern: "\\bbaz\\b", reason: "no baz", suggestion: "use qux" }],
    });

    const result = loadForbiddenPatterns(projectDir);
    expect(result).toHaveLength(2);
    expect(result[0].pattern).toBe("\\bbaz\\b");
    expect(result[1].pattern).toBe("\\bfoo\\b");
  });

  test("child overrides parent with disabled:true", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(tmpDir, {
      forbiddenPatterns: [
        { pattern: "\\bfoo\\b", reason: "no foo", suggestion: "use bar" },
        { pattern: "\\bbaz\\b", reason: "no baz", suggestion: "use qux" },
      ],
    });
    writeConfig(projectDir, {
      forbiddenPatterns: [{ pattern: "\\bfoo\\b", disabled: true }],
    });

    const result = loadForbiddenPatterns(projectDir);
    expect(result).toHaveLength(1);
    expect(result[0].pattern).toBe("\\bbaz\\b");
  });

  test("child overrides parent with different reason/suggestion", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(tmpDir, {
      forbiddenPatterns: [{ pattern: "\\bfoo\\b", reason: "original", suggestion: "original" }],
    });
    writeConfig(projectDir, {
      forbiddenPatterns: [{ pattern: "\\bfoo\\b", reason: "overridden", suggestion: "overridden" }],
    });

    const result = loadForbiddenPatterns(projectDir);
    expect(result).toEqual([
      { pattern: "\\bfoo\\b", reason: "overridden", suggestion: "overridden" },
    ]);
  });

  test("skips malformed JSON files", () => {
    const claudeDir = join(tmpDir, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, "pre-bash.json"), "not json");

    expect(loadForbiddenPatterns(tmpDir)).toEqual([]);
  });

  test("handles config without forbiddenPatterns field", () => {
    writeConfig(tmpDir, {});
    expect(loadForbiddenPatterns(tmpDir)).toEqual([]);
  });

  test("returns empty array when HOME is not set", () => {
    delete process.env.HOME;
    expect(loadForbiddenPatterns("/some/path")).toEqual([]);
  });
});
