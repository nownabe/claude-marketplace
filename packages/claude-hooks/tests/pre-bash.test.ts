import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import {
  loadForbiddenPatterns,
  checkForbiddenPatterns,
  globToRegExp,
  splitCommand,
  type ActivePattern,
} from "../src/pre-bash";

describe("splitCommand", () => {
  test("returns single command as-is", () => {
    expect(splitCommand("git status")).toEqual(["git status"]);
  });

  test("splits on &&", () => {
    expect(splitCommand("git add . && git commit -m msg")).toEqual([
      "git add .",
      "git commit -m msg",
    ]);
  });

  test("splits on ||", () => {
    expect(splitCommand("cmd1 || cmd2")).toEqual(["cmd1", "cmd2"]);
  });

  test("splits on ;", () => {
    expect(splitCommand("cmd1 ; cmd2")).toEqual(["cmd1", "cmd2"]);
  });

  test("splits on |", () => {
    expect(splitCommand("ls | grep foo")).toEqual(["ls", "grep foo"]);
  });

  test("splits on mixed operators", () => {
    expect(splitCommand("a && b || c ; d | e")).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("globToRegExp", () => {
  test("exact match", () => {
    const re = globToRegExp("git status");
    expect(re.test("git status")).toBe(true);
    expect(re.test("git status --short")).toBe(false);
    expect(re.test("git statusx")).toBe(false);
  });

  test("trailing wildcard with space enforces word boundary", () => {
    const re = globToRegExp("git commit *");
    expect(re.test("git commit -m msg")).toBe(true);
    expect(re.test("git commit")).toBe(true);
    expect(re.test("git commitall")).toBe(false);
  });

  test("trailing wildcard without space matches any suffix", () => {
    const re = globToRegExp("git*");
    expect(re.test("git")).toBe(true);
    expect(re.test("gitk")).toBe(true);
    expect(re.test("git status")).toBe(true);
  });

  test("wildcard in the middle", () => {
    const re = globToRegExp("git * main");
    expect(re.test("git checkout main")).toBe(true);
    expect(re.test("git merge main")).toBe(true);
    expect(re.test("git main")).toBe(false);
  });

  test("deprecated :* syntax is equivalent to space-*", () => {
    const re = globToRegExp("git commit:*");
    expect(re.test("git commit -m msg")).toBe(true);
    expect(re.test("git commit")).toBe(true);
    expect(re.test("git commitall")).toBe(false);
  });

  test("escapes regex special characters", () => {
    const re = globToRegExp("npm run build (prod)");
    expect(re.test("npm run build (prod)")).toBe(true);
    expect(re.test("npm run build prod")).toBe(false);
  });

  test("wildcard at the beginning", () => {
    const re = globToRegExp("* --version");
    expect(re.test("node --version")).toBe(true);
    expect(re.test("bun --version")).toBe(true);
  });
});

describe("checkForbiddenPatterns", () => {
  describe("with glob patterns", () => {
    const patterns: ActivePattern[] = [
      {
        pattern: "git -C *",
        reason: "git -C is forbidden",
        suggestion: "Use cd instead",
      },
      {
        pattern: "rm -rf /*",
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

    test("checks each sub-command for shell operators", () => {
      const result = checkForbiddenPatterns("echo hello && rm -rf /tmp", patterns);
      expect(result?.reason).toBe("rm -rf / is forbidden");
    });

    test("does not match pattern across shell operators", () => {
      const patterns: ActivePattern[] = [
        { pattern: "safe-cmd malicious-cmd", reason: "forbidden", suggestion: "none" },
      ];
      // "safe-cmd malicious-cmd" as a single pattern should not match
      // when they are separate sub-commands
      expect(checkForbiddenPatterns("safe-cmd && malicious-cmd", patterns)).toBeNull();
    });

    test("matches sub-command independently", () => {
      const patterns: ActivePattern[] = [
        { pattern: "rm -rf *", reason: "forbidden", suggestion: "none" },
      ];
      expect(checkForbiddenPatterns("echo hello && rm -rf /tmp", patterns)).not.toBeNull();
    });

    test("returns null for empty patterns", () => {
      expect(checkForbiddenPatterns("git -C /tmp", [])).toBeNull();
    });
  });

  describe("with regex patterns", () => {
    const patterns: ActivePattern[] = [
      {
        pattern: "\\bgit\\s+-C\\b",
        reason: "git -C is forbidden",
        suggestion: "Use cd instead",
      },
    ];

    test("matches regex pattern", () => {
      const result = checkForbiddenPatterns("git -C /tmp status", patterns);
      expect(result?.reason).toBe("git -C is forbidden");
    });

    test("returns null when regex does not match", () => {
      expect(checkForbiddenPatterns("git status", patterns)).toBeNull();
    });
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

  function writeConfig(dir: string, preBashConfig: object) {
    const claudeDir = join(dir, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(
      join(claudeDir, "nownabe-claude-hooks.json"),
      JSON.stringify({ preBash: preBashConfig }),
    );
  }

  test("returns empty array when no config files exist", () => {
    const cwd = join(tmpDir, "a", "b");
    mkdirSync(cwd, { recursive: true });
    expect(loadForbiddenPatterns(cwd)).toEqual([]);
  });

  test("loads patterns from HOME", () => {
    writeConfig(tmpDir, {
      forbiddenPatterns: {
        "\\bfoo\\b": { reason: "no foo", suggestion: "use bar" },
      },
    });
    expect(loadForbiddenPatterns(tmpDir)).toEqual([
      { pattern: "\\bfoo\\b", reason: "no foo", suggestion: "use bar" },
    ]);
  });

  test("merges parent and child patterns", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(tmpDir, {
      forbiddenPatterns: {
        "\\bfoo\\b": { reason: "no foo", suggestion: "use bar" },
      },
    });
    writeConfig(projectDir, {
      forbiddenPatterns: {
        "\\bbaz\\b": { reason: "no baz", suggestion: "use qux" },
      },
    });

    const result = loadForbiddenPatterns(projectDir);
    expect(result).toHaveLength(2);
    expect(result.find((p) => p.pattern === "\\bfoo\\b")).toBeTruthy();
    expect(result.find((p) => p.pattern === "\\bbaz\\b")).toBeTruthy();
  });

  test("child can override parent pattern config", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(tmpDir, {
      forbiddenPatterns: {
        "\\bfoo\\b": { reason: "no foo", suggestion: "use bar" },
      },
    });
    writeConfig(projectDir, {
      forbiddenPatterns: {
        "\\bfoo\\b": { reason: "updated reason", suggestion: "updated suggestion" },
      },
    });

    const result = loadForbiddenPatterns(projectDir);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      pattern: "\\bfoo\\b",
      reason: "updated reason",
      suggestion: "updated suggestion",
    });
  });

  test("inherits parent patterns when child has no preBash section", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(tmpDir, {
      forbiddenPatterns: {
        "\\bfoo\\b": { reason: "no foo", suggestion: "use bar" },
      },
    });
    // child has no preBash config at all — write a config with only notification
    const claudeDir = join(projectDir, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(
      join(claudeDir, "nownabe-claude-hooks.json"),
      JSON.stringify({ notification: { sounds: {} } }),
    );

    const result = loadForbiddenPatterns(projectDir);
    expect(result).toHaveLength(1);
    expect(result[0].pattern).toBe("\\bfoo\\b");
  });

  test("child can disable parent pattern", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(tmpDir, {
      forbiddenPatterns: {
        "\\bfoo\\b": { reason: "no foo", suggestion: "use bar" },
        "\\bbaz\\b": { reason: "no baz", suggestion: "use qux" },
      },
    });
    writeConfig(projectDir, {
      forbiddenPatterns: {
        "\\bfoo\\b": { disabled: true },
      },
    });

    const result = loadForbiddenPatterns(projectDir);
    expect(result).toHaveLength(1);
    expect(result[0].pattern).toBe("\\bbaz\\b");
  });

  test("filters out disabled entries", () => {
    writeConfig(tmpDir, {
      forbiddenPatterns: {
        "\\bfoo\\b": { reason: "no foo", suggestion: "use bar" },
        "\\bbaz\\b": { disabled: true },
      },
    });

    const result = loadForbiddenPatterns(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].pattern).toBe("\\bfoo\\b");
  });

  test("skips malformed JSON files", () => {
    const claudeDir = join(tmpDir, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, "nownabe-claude-hooks.json"), "not json");

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
