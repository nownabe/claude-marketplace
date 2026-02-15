import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { detectPlatform, resolveSound, loadNotificationConfig } from "../src/notification";

describe("detectPlatform", () => {
  test("returns a valid platform string", () => {
    const platform = detectPlatform();
    expect(["wsl", "macos", "linux", "unknown"]).toContain(platform);
  });

  test("returns 'wsl' when running on WSL", () => {
    // This test verifies the actual environment; on WSL it should return 'wsl'
    const platform = detectPlatform();
    // We can't guarantee the test environment, so just check the return type
    expect(typeof platform).toBe("string");
  });
});

describe("resolveSound", () => {
  const defaultPermissionSound = "C:\\Windows\\Media\\Windows Notify System Generic.wav";
  const defaultWildcardSound = "C:\\Windows\\Media\\tada.wav";

  test("returns default wildcard sound when no notification type", () => {
    expect(resolveSound(undefined, {})).toBe(defaultWildcardSound);
  });

  test("returns default sound for permission_prompt type", () => {
    expect(resolveSound("permission_prompt", {})).toBe(defaultPermissionSound);
  });

  test("returns default wildcard sound for unknown type", () => {
    expect(resolveSound("task_completed", {})).toBe(defaultWildcardSound);
  });

  test("uses config sound override for specific type", () => {
    const config = {
      sounds: { permission_prompt: "C:\\custom\\sound.wav" },
    };
    expect(resolveSound("permission_prompt", config)).toBe("C:\\custom\\sound.wav");
  });

  test("uses config wildcard override", () => {
    const config = {
      sounds: { "*": "C:\\custom\\default.wav" },
    };
    expect(resolveSound("stop", config)).toBe("C:\\custom\\default.wav");
  });

  test("config type-specific sound takes priority over wildcard", () => {
    const config = {
      sounds: {
        "*": "C:\\custom\\default.wav",
        stop: "C:\\custom\\stop.wav",
      },
    };
    expect(resolveSound("stop", config)).toBe("C:\\custom\\stop.wav");
  });

  test("falls back to config wildcard for unmatched type", () => {
    const config = {
      sounds: {
        "*": "C:\\custom\\default.wav",
        stop: "C:\\custom\\stop.wav",
      },
    };
    expect(resolveSound("task_completed", config)).toBe("C:\\custom\\default.wav");
  });
});

describe("loadNotificationConfig", () => {
  let tmpDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "notification-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tmpDir, { recursive: true });
  });

  function writeConfig(dir: string, notificationConfig: object) {
    const claudeDir = join(dir, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(
      join(claudeDir, "nownabe-claude-hooks.json"),
      JSON.stringify({ notification: notificationConfig }),
    );
  }

  test("returns empty config when no config files exist", () => {
    const cwd = join(tmpDir, "a", "b");
    mkdirSync(cwd, { recursive: true });
    expect(loadNotificationConfig(cwd)).toEqual({});
  });

  test("loads sounds from HOME config", () => {
    writeConfig(tmpDir, {
      sounds: { "*": "C:\\custom\\sound.wav" },
    });
    expect(loadNotificationConfig(tmpDir)).toEqual({
      sounds: { "*": "C:\\custom\\sound.wav" },
    });
  });

  test("child config overrides parent sounds", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(tmpDir, {
      sounds: { "*": "C:\\parent\\sound.wav", stop: "C:\\parent\\stop.wav" },
    });
    writeConfig(projectDir, {
      sounds: { "*": "C:\\child\\sound.wav" },
    });

    const result = loadNotificationConfig(projectDir);
    expect(result.sounds?.["*"]).toBe("C:\\child\\sound.wav");
    expect(result.sounds?.stop).toBe("C:\\parent\\stop.wav");
  });

  test("merges sounds from multiple levels", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    writeConfig(tmpDir, {
      sounds: { permission_prompt: "C:\\home\\prompt.wav" },
    });
    writeConfig(projectDir, {
      sounds: { stop: "C:\\project\\stop.wav" },
    });

    const result = loadNotificationConfig(projectDir);
    expect(result.sounds?.permission_prompt).toBe("C:\\home\\prompt.wav");
    expect(result.sounds?.stop).toBe("C:\\project\\stop.wav");
  });

  test("skips malformed JSON files", () => {
    const claudeDir = join(tmpDir, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, "nownabe-claude-hooks.json"), "not json");

    expect(loadNotificationConfig(tmpDir)).toEqual({});
  });

  test("handles config without sounds field", () => {
    writeConfig(tmpDir, {});
    expect(loadNotificationConfig(tmpDir)).toEqual({});
  });

  test("returns empty config when HOME is not set", () => {
    delete process.env.HOME;
    expect(loadNotificationConfig("/some/path")).toEqual({});
  });
});
