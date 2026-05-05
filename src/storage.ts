/**
 * Storage layout
 * --------------
 * Root:  ~/MeetingNotes/                          (configurable via MNT_ROOT)
 * Per-session folder:
 *        ~/MeetingNotes/2026-05-04T10-30_zoom/
 *        ├── audio.wav
 *        ├── transcript.md
 *        └── metadata.json
 *
 * Active-session state lives at:
 *        $TMPDIR/mnt-session.json
 * It records the in-progress recording's folder + ffmpeg PID so `mnt stop`
 * can find and stop it.
 */

import { homedir, tmpdir } from "node:os";
import { mkdirSync, existsSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import dayjs from "dayjs";

export interface MeetingMetadata {
  id: string;
  title: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  source: "zoom" | "manual" | "other";
  audio_path: string;
  transcript_path?: string;
}

export interface ActiveSession {
  id: string;
  folder: string;
  audio_path: string;
  pid: number;
  started_at: string;
  source: "zoom" | "manual" | "other";
}

/** Root folder for all meeting recordings. Override with MNT_ROOT. */
export function getRoot(): string {
  return process.env.MNT_ROOT || join(homedir(), "MeetingNotes");
}

/** Where we keep the single in-progress session record. */
export function getActiveSessionPath(): string {
  return join(tmpdir(), "mnt-session.json");
}

/** "design review!" → "design-review" */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "meeting";
}

/**
 * Build a folder ID like "2026-05-04T10-30_zoom" or
 * "2026-05-04T10-30_quick-sync".
 */
export function buildSessionId(opts: { now?: Date; label?: string } = {}): string {
  const stamp = dayjs(opts.now ?? new Date()).format("YYYY-MM-DDTHH-mm");
  const label = slugify(opts.label || "zoom");
  return `${stamp}_${label}`;
}

/**
 * Create the session folder under root and return absolute paths.
 * Idempotent — safe to call if the folder already exists.
 */
export function createSessionFolder(id: string): {
  folder: string;
  audioPath: string;
  transcriptPath: string;
  metadataPath: string;
} {
  const folder = join(getRoot(), id);
  mkdirSync(folder, { recursive: true });
  return {
    folder,
    audioPath: join(folder, "audio.wav"),
    transcriptPath: join(folder, "transcript.md"),
    metadataPath: join(folder, "metadata.json"),
  };
}

export function writeMetadata(path: string, meta: MeetingMetadata): void {
  writeFileSync(path, JSON.stringify(meta, null, 2) + "\n", "utf8");
}

export function readMetadata(path: string): MeetingMetadata {
  return JSON.parse(readFileSync(path, "utf8")) as MeetingMetadata;
}

export function saveActiveSession(s: ActiveSession): void {
  writeFileSync(getActiveSessionPath(), JSON.stringify(s, null, 2), "utf8");
}

export function loadActiveSession(): ActiveSession | null {
  const p = getActiveSessionPath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as ActiveSession;
  } catch {
    return null;
  }
}

export function clearActiveSession(): void {
  const p = getActiveSessionPath();
  if (existsSync(p)) rmSync(p, { force: true });
}
