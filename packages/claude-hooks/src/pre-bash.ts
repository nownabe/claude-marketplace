/**
 * PreToolUse hook for Bash commands.
 * Runs multiple checkers against the command and returns a deny decision
 * if any checker rejects it.
 */

import { loadConfig } from "./config";

// --- Types ---

/**
 * Common input fields.
 * @see https://code.claude.com/docs/en/hooks#common-input-fields
 */
interface HookCommonInput {
  /** Current session identifier. */
  session_id: string;
  /** Path to conversation JSON. */
  transcript_path: string;
  /** Current working directory when the hook is invoked. */
  cwd: string;
  /** Current permission mode: "default", "plan", "acceptEdits", "dontAsk", or "bypassPermissions". */
  permission_mode: string;
  /** Name of the event that fired. */
  hook_event_name: string;
}

/**
 * Tool-specific input fields for PreToolUse.
 * @see https://code.claude.com/docs/en/hooks#pretooluse-input
 */
interface HookInput extends HookCommonInput {
  /** Name of the tool being called. */
  tool_name: string;
  /** The parameters sent to the tool. */
  tool_input: {
    /** The command to execute. */
    command: string;
    /** Clear, concise description of what this command does. */
    description?: string;
    /** Optional timeout in milliseconds (max 600000). */
    timeout?: number;
    /** Set to true to run this command in the background. */
    run_in_background?: boolean;
  };
  /** Unique identifier for this tool call. */
  tool_use_id: string;
}

interface DenyResult {
  reason: string;
  suggestion: string;
}

/**
 * Hook output for PreToolUse.
 * @see https://code.claude.com/docs/en/hooks#hook-output
 */
interface HookOutput {
  hookSpecificOutput: {
    /** Name of the event that fired. */
    hookEventName: "PreToolUse";
    /** "allow" bypasses the permission system, "deny" prevents the tool call, "ask" prompts the user to confirm. */
    permissionDecision: "allow" | "deny" | "ask";
    /** For "allow" and "ask", shown to the user but not Claude. For "deny", shown to Claude. */
    permissionDecisionReason?: string;
    /** Modifies the tool's input parameters before execution. Combine with "allow" to auto-approve, or "ask" to show the modified input to the user. */
    updatedInput?: Record<string, unknown>;
    /** String added to Claude's context before the tool executes. */
    additionalContext?: string;
  };
}

// --- Feature: Forbidden Command Patterns ---

export type ForbiddenPatternEntry =
  | { pattern: string; reason: string; suggestion: string; disabled?: false }
  | { pattern: string; disabled: true };

/**
 * Load forbidden patterns from the unified config.
 * Reads `config.preBash.forbiddenPatterns` and filters out disabled entries.
 */
export function loadForbiddenPatterns(cwd: string): ActivePattern[] {
  const config = loadConfig(cwd);
  const patterns = config.preBash?.forbiddenPatterns ?? [];
  return patterns.filter((entry): entry is ActivePattern => !entry.disabled);
}

export type ActivePattern = Extract<ForbiddenPatternEntry, { reason: string }>;

export function checkForbiddenPatterns(
  command: string,
  patterns: ActivePattern[],
): DenyResult | null {
  for (const { pattern, reason, suggestion } of patterns) {
    if (new RegExp(pattern).test(command)) {
      return { reason, suggestion };
    }
  }
  return null;
}

// --- Checker Pipeline ---

type Checker = (command: string) => DenyResult | null;

// --- Main ---

export async function main() {
  const text = await Bun.stdin.text();
  const input: HookInput = JSON.parse(text);
  const command = input.tool_input.command;

  const forbiddenPatterns = loadForbiddenPatterns(input.cwd);
  const checkers: Checker[] = [(cmd) => checkForbiddenPatterns(cmd, forbiddenPatterns)];

  for (const checker of checkers) {
    const result = checker(command);
    if (result) {
      const output: HookOutput = {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `${result.reason} ${result.suggestion}`,
          additionalContext: result.suggestion,
        },
      };
      console.log(JSON.stringify(output));
      process.exit(0);
    }
  }

  // All checks passed — no opinion, let normal permission flow continue.
  process.exit(0);
}
