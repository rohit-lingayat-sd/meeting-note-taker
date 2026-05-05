/**
 * Transcription via whisper.cpp (wrapped by nodejs-whisper).
 *
 * Strategy:
 *   1. Run nodewhisper on audio.wav, requesting an SRT sidecar.
 *      nodejs-whisper writes audio.wav.srt next to the input.
 *   2. Parse the SRT and re-emit it as a clean markdown transcript with
 *      [HH:MM:SS] line prefixes — readable on its own and great for pasting
 *      into Claude / ChatGPT / Perplexity.
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { nodewhisper } from "nodejs-whisper";
import dayjs from "dayjs";

export interface TranscribeOptions {
  audioPath: string;
  outputPath: string;          // where transcript.md goes
  meetingTitle: string;
  startedAt: string;           // ISO
  durationSeconds?: number;
  model?: string;              // e.g. "medium.en"
}

export interface TranscribeResult {
  transcriptPath: string;
  segmentCount: number;
  wordCount: number;
}

const DEFAULT_MODEL = "medium.en";

export async function transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
  const model = opts.model || process.env.MNT_WHISPER_MODEL || DEFAULT_MODEL;

  if (!existsSync(opts.audioPath)) {
    throw new Error(`Audio file not found: ${opts.audioPath}`);
  }

  // nodejs-whisper writes sidecars like <audio>.wav.srt next to the input.
  await nodewhisper(opts.audioPath, {
    modelName: model,
    autoDownloadModelName: model,
    whisperOptions: {
      outputInSrt: true,
      outputInText: true,
      timestamps_length: 1,
    },
  });

  const srtPath = `${opts.audioPath}.srt`;
  if (!existsSync(srtPath)) {
    throw new Error(`Whisper did not produce an SRT at ${srtPath}`);
  }

  const segments = parseSrt(readFileSync(srtPath, "utf8"));
  const md = renderMarkdown(segments, opts);
  writeFileSync(opts.outputPath, md, "utf8");

  const wordCount = segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);

  return {
    transcriptPath: opts.outputPath,
    segmentCount: segments.length,
    wordCount,
  };
}

interface SrtSegment {
  start: number; // seconds
  end: number;
  text: string;
}

/** Minimal SRT parser. Whisper SRT is well-formed so we keep it simple. */
function parseSrt(srt: string): SrtSegment[] {
  const blocks = srt.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  const out: SrtSegment[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;
    const timing = lines[1];
    const m = timing.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!m) continue;
    const start = toSeconds(m[1], m[2], m[3], m[4]);
    const end = toSeconds(m[5], m[6], m[7], m[8]);
    const text = lines.slice(2).join(" ").trim();
    if (text) out.push({ start, end, text });
  }
  return out;
}

function toSeconds(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

function fmtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} h ${rem} min` : `${h} h`;
}

function renderMarkdown(segments: SrtSegment[], opts: TranscribeOptions): string {
  const header = [
    `# ${opts.meetingTitle}`,
    "",
    `- **Recorded:** ${dayjs(opts.startedAt).format("YYYY-MM-DD HH:mm")}`,
    opts.durationSeconds ? `- **Duration:** ${fmtDuration(opts.durationSeconds)}` : null,
    `- **Segments:** ${segments.length}`,
    "",
    "---",
    "",
  ].filter(Boolean).join("\n");

  const body = segments
    .map((s) => `[${fmtTimestamp(s.start)}] ${s.text}`)
    .join("\n\n");

  return header + body + "\n";
}
