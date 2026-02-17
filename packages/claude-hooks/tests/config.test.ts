import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { collectAncestorDirs, deepMerge, loadConfig } from "../src/config";

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

describe("deepMerge", () => {
  test("merges flat objects", () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  test("override wins for same key", () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  test("recursively merges nested objects", () => {
    const base = { nested: { a: 1, b: 2 } };
    const override = { nested: { b: 3, c: 4 } };
    expect(deepMerge(base, override)).toEqual({ nested: { a: 1, b: 3, c: 4 } });
  });

  test("arrays are replaced entirely", () => {
    const base = { items: [1, 2, 3] };
    const override = { items: [4, 5] };
    expect(deepMerge(base, override)).toEqual({ items: [4, 5] });
  });

  test("primitives are replaced", () => {
    expect(deepMerge({ a: "foo" }, { a: "bar" })).toEqual({ a: "bar" });
  });

  test("override object replaces primitive", () => {
    expect(deepMerge({ a: 1 }, { a: { nested: true } })).toEqual({ a: { nested: true } });
  });

  test("override primitive replaces object", () => {
    expect(deepMerge({ a: { nested: true } }, { a: 1 })).toEqual({ a: 1 });
  });

  test("handles empty objects", () => {
    expect(deepMerge({}, { a: 1 })).toEqual({ a: 1 });
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 });
  });

  test("deeply nested merge", () => {
    const base = { a: { b: { c: 1, d: 2 } } };
    const override = { a: { b: { d: 3, e: 4 } } };
    expect(deepMerge(base, override)).toEqual({ a: { b: { c: 1, d: 3, e: 4 } } });
  });
});

describe("loadConfig", () => {
  let tmpDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "config-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tmpDir, { recursive: true });
  });

  function writeConfig(dir: string, config: object, local = false) {
    const claudeDir = join(dir, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    const filename = local ? "nownabe-claude-hooks.local.json" : "nownabe-claude-hooks.json";
    writeFileSync(join(claudeDir, filename), JSON.stringify(config));
  }

  test("returns empty config when no config files exist", () => {
    const cwd = join(tmpDir, "a", "b");
    mkdirSync(cwd, { recursive: true });
    expect(loadConfig(cwd)).toEqual({});
  });

  test("loads config from HOME", () => {
    writeConfig(tmpDir, {
      preBash: {
        forbiddenPatterns: [{ pattern: "\\bfoo\\b", reason: "no foo", suggestion: "use bar" }],
      },
    });
    const config = loadConfig(tmpDir);
    expect(config.preBash?.forbiddenPatterns).toEqual([
      { pattern: "\\bfoo\\b", reason: "no foo", suggestion: "use bar" },
    ]);
  });

  test("deep merges notification sounds from multiple levels", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(tmpDir, {
      notification: { sounds: { "*": "parent.wav", stop: "parent-stop.wav" } },
    });
    writeConfig(projectDir, {
      notification: { sounds: { "*": "child.wav" } },
    });

    const config = loadConfig(projectDir);
    expect(config.notification?.sounds?.["*"]).toBe("child.wav");
    expect(config.notification?.sounds?.stop).toBe("parent-stop.wav");
  });

  test("child array replaces parent array entirely", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(tmpDir, {
      preBash: {
        forbiddenPatterns: [
          { pattern: "\\bfoo\\b", reason: "no foo", suggestion: "use bar" },
          { pattern: "\\bbaz\\b", reason: "no baz", suggestion: "use qux" },
        ],
      },
    });
    writeConfig(projectDir, {
      preBash: {
        forbiddenPatterns: [
          { pattern: "\\bonly\\b", reason: "only this", suggestion: "just this" },
        ],
      },
    });

    const config = loadConfig(projectDir);
    expect(config.preBash?.forbiddenPatterns).toEqual([
      { pattern: "\\bonly\\b", reason: "only this", suggestion: "just this" },
    ]);
  });

  test(".local.json has higher priority than .json in same directory", () => {
    writeConfig(tmpDir, {
      notification: { sounds: { "*": "normal.wav" } },
    });
    writeConfig(
      tmpDir,
      {
        notification: { sounds: { "*": "local.wav" } },
      },
      true,
    );

    const config = loadConfig(tmpDir);
    expect(config.notification?.sounds?.["*"]).toBe("local.wav");
  });

  test(".local.json in child overrides .json in child", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(projectDir, {
      notification: { sounds: { "*": "normal.wav" } },
    });
    writeConfig(
      projectDir,
      {
        notification: { sounds: { "*": "local.wav" } },
      },
      true,
    );

    const config = loadConfig(projectDir);
    expect(config.notification?.sounds?.["*"]).toBe("local.wav");
  });

  test("child .json overrides parent .local.json", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(
      tmpDir,
      {
        notification: { sounds: { "*": "parent-local.wav" } },
      },
      true,
    );
    writeConfig(projectDir, {
      notification: { sounds: { "*": "child.wav" } },
    });

    const config = loadConfig(projectDir);
    expect(config.notification?.sounds?.["*"]).toBe("child.wav");
  });

  test("merges preBash and notification from different levels", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(tmpDir, {
      preBash: {
        forbiddenPatterns: [{ pattern: "\\bfoo\\b", reason: "no foo", suggestion: "use bar" }],
      },
    });
    writeConfig(projectDir, {
      notification: { sounds: { "*": "child.wav" } },
    });

    const config = loadConfig(projectDir);
    expect(config.preBash?.forbiddenPatterns).toEqual([
      { pattern: "\\bfoo\\b", reason: "no foo", suggestion: "use bar" },
    ]);
    expect(config.notification?.sounds?.["*"]).toBe("child.wav");
  });

  test("skips malformed JSON files", () => {
    const claudeDir = join(tmpDir, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, "nownabe-claude-hooks.json"), "not json");

    expect(loadConfig(tmpDir)).toEqual({});
  });

  test("returns empty config when HOME is not set", () => {
    delete process.env.HOME;
    expect(loadConfig("/some/path")).toEqual({});
  });
});
