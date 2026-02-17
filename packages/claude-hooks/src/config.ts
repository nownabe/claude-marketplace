/**
 * Unified config loader for nownabe-claude-hooks.
 * Loads and deep-merges config files from CWD up to HOME.
 */

import { resolve, dirname, join } from "path";
import { existsSync, readFileSync } from "fs";
import type { ForbiddenPatternEntry } from "./pre-bash";

// --- Types ---

export interface Config {
  preBash?: {
    forbiddenPatterns?: ForbiddenPatternEntry[];
  };
  notification?: {
    sounds?: Record<string, string>;
  };
}

// --- Constants ---

const CONFIG_FILENAME = "nownabe-claude-hooks.json";
const LOCAL_CONFIG_FILENAME = "nownabe-claude-hooks.local.json";

// --- Helpers ---

/**
 * Collect directories from `startDir` up to (and including) `stopDir`.
 * Returns paths from startDir (most specific) to stopDir (least specific).
 */
export function collectAncestorDirs(startDir: string, stopDir: string): string[] {
  const start = resolve(startDir);
  const stop = resolve(stopDir);
  const dirs: string[] = [];
  let current = start;
  for (;;) {
    dirs.push(current);
    if (current === stop) break;
    const parent = dirname(current);
    if (parent === current) break; // reached filesystem root
    current = parent;
  }
  return dirs;
}

/**
 * Recursively deep merge two objects.
 * - Objects: recursively merged (keys from `override` win)
 * - Arrays/primitives: replaced entirely by `override`
 */
export function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overrideVal = override[key];
    if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Load config files from CWD up to HOME and deep merge them.
 *
 * File priority (highest first, per directory from CWD to HOME):
 * 1. CWD/.claude/nownabe-claude-hooks.local.json
 * 2. CWD/.claude/nownabe-claude-hooks.json
 * 3. <parent>/.claude/nownabe-claude-hooks.local.json
 * 4. <parent>/.claude/nownabe-claude-hooks.json
 * 5. ... up to HOME
 *
 * Merge: Start from the lowest-priority file, deep merge upward.
 */
export function loadConfig(cwd: string): Config {
  const home = process.env.HOME ?? "";
  if (!home) return {};

  const dirs = collectAncestorDirs(cwd, home);

  // Collect config files in priority order (highest first).
  // Per directory: local file has higher priority than non-local.
  const configFiles: string[] = [];
  for (const dir of dirs) {
    const claudeDir = join(dir, ".claude");
    const localPath = join(claudeDir, LOCAL_CONFIG_FILENAME);
    const normalPath = join(claudeDir, CONFIG_FILENAME);
    if (existsSync(localPath)) configFiles.push(localPath);
    if (existsSync(normalPath)) configFiles.push(normalPath);
  }

  // Merge from lowest priority (last) to highest priority (first).
  let merged: Record<string, unknown> = {};
  for (const filePath of configFiles.reverse()) {
    try {
      const content = JSON.parse(readFileSync(filePath, "utf-8"));
      if (isPlainObject(content)) {
        merged = deepMerge(merged, content);
      }
    } catch {
      // skip malformed files
    }
  }

  return merged as Config;
}
