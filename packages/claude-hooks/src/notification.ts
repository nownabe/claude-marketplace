/**
 * Notification hook for Claude Code.
 * Sends OS-native notifications (currently WSL/Windows only).
 * Reads notification config from `.claude/notification.json` files
 * in the directory hierarchy (CWD up to HOME), with child overrides.
 */

import { existsSync, readFileSync } from "fs";
import { execFileSync } from "child_process";
import { loadConfig } from "./config";

// --- Types ---

interface NotificationInput {
  title: string;
  message: string;
  notification_type?: string;
}

interface NotificationConfig {
  sounds?: Record<string, string>;
}

export type Platform = "wsl" | "macos" | "linux" | "unknown";

// --- Constants ---

const DEFAULT_SOUNDS: Record<string, string> = {
  permission_prompt: "C:\\Windows\\Media\\Windows Notify System Generic.wav",
  "*": "C:\\Windows\\Media\\tada.wav",
};

// --- Platform Detection ---

export function detectPlatform(): Platform {
  try {
    const version = readFileSync("/proc/version", "utf-8").toLowerCase();
    if (version.includes("microsoft") || version.includes("wsl")) {
      return "wsl";
    }
  } catch {
    // /proc/version doesn't exist (e.g. macOS)
  }

  if (process.platform === "darwin") return "macos";
  if (process.platform === "linux") return "linux";
  return "unknown";
}

// --- Config Loading ---

export function loadNotificationConfig(cwd: string): NotificationConfig {
  const config = loadConfig(cwd);
  return config.notification ?? {};
}

// --- Sound Resolution ---

export function resolveSound(
  notificationType: string | undefined,
  config: NotificationConfig,
): string {
  const sounds = { ...DEFAULT_SOUNDS, ...config.sounds };

  if (notificationType && sounds[notificationType]) {
    return sounds[notificationType];
  }

  return sounds["*"] ?? DEFAULT_SOUNDS["*"];
}

// --- WSL Notification ---

export function findPowershell(): string | null {
  try {
    const result = execFileSync("which", ["powershell.exe"], {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    if (result) return result;
  } catch {
    // not in PATH
  }

  const fallback = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
  if (existsSync(fallback)) return fallback;

  return null;
}

function escapePowershellString(s: string): string {
  return s.replace(/'/g, "''");
}

export function notifyWsl(title: string, message: string, sound: string): void {
  const ps = findPowershell();
  if (!ps) {
    console.error("powershell.exe not found, skipping notification");
    return;
  }

  const escapedTitle = escapePowershellString(title);
  const escapedMessage = escapePowershellString(message);
  const escapedSound = escapePowershellString(sound);

  const script = [
    `$sound = New-Object System.Media.SoundPlayer '${escapedSound}'`,
    `$sound.playsync()`,
    `Add-Type -AssemblyName System.Windows.Forms`,
    `$notify = New-Object System.Windows.Forms.NotifyIcon`,
    `$notify.Icon = [System.Drawing.SystemIcons]::Information`,
    `$notify.BalloonTipTitle = '${escapedTitle}'`,
    `$notify.BalloonTipText = '${escapedMessage}'`,
    `$notify.Visible = $true`,
    `$notify.ShowBalloonTip(5000)`,
    `Start-Sleep -Seconds 1`,
    `$notify.Dispose()`,
  ].join("; ");

  try {
    execFileSync(ps, ["-NoProfile", "-NonInteractive", "-Command", script], {
      timeout: 30000,
      stdio: "ignore",
    });
  } catch {
    console.error("Failed to send Windows notification");
  }
}

// --- Main ---

export async function main() {
  const text = await Bun.stdin.text();
  const input: NotificationInput = JSON.parse(text);

  const title = input.title ?? "Claude Code";
  const message = input.message ?? "";
  const notificationType = input.notification_type;

  const cwd = process.cwd();
  const config = loadNotificationConfig(cwd);
  const sound = resolveSound(notificationType, config);

  const platform = detectPlatform();

  switch (platform) {
    case "wsl":
      notifyWsl(title, message, sound);
      break;
    case "macos":
    case "linux":
    case "unknown":
      // Future: add native notifications for other platforms
      break;
  }
}
