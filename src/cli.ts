#!/usr/bin/env node
/**
 * mnt — Meeting Note Taker CLI (M1)
 *
 *   mnt start [--title "..."]   begin recording (default mic)
 *   mnt stop                    stop, transcribe, write transcript.md
 *   mnt status                  show whether a session is active
 *   mnt transcribe <audio>      transcribe an existing wav (testing)
 *
 * Single-active-session model: only one recording at a time. State lives
 * at $TMPDIR/mnt-session.json so `mnt stop` from any terminal can find it.
 */

import { Command } from "commander";
import dayjs from "dayjs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildSessionId,
  createSessionFolder,
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
  writeMetadata,
  getRoot,
  type ActiveSession,
} from "./storage.js";
import { startRecording, stopRecording, checkFfmpeg } from "./record.js";
import { transcribe } from "./transcribe.js";

const program = new Command();
program
  .name("mnt")
  .description("Meeting Note Taker — record, transcribe, hand off to AI")
  .version("0.1.0");

program
  .command("start")
  .description("Start recording the default audio input")
  .option("-t, --title <title>", "Meeting title (used in folder slug)", "zoom")
  .action(async (opts: { title: string }) => {
    const existing = loadActiveSession();
    if (existing) {
      console.error(
        `A recording is already in progress (started ${existing.started_at}).`
      );
      console.error(`Stop it first with:  mnt stop`);
      process.exit(1);
    }

    try {
      await checkFfmpeg();
    } catch (err: any) {
      console.error("ffmpeg is required but not found on PATH.");
      console.error("Install it with:  brew install ffmpeg   (macOS)");
      process.exit(1);
    }

    const startedAt = new Date();
    const id = buildSessionId({ now: startedAt, label: opts.title });
    const { folder, audioPath } = createSessionFolder(id);

    const handle = startRecording(audioPath);

    const session: ActiveSession = {
      id,
      folder,
      audio_path: audioPath,
      pid: handle.pid,
      started_at: startedAt.toISOString(),
      source: "manual",
    };
    saveActiveSession(session);

    console.log(`Recording started.`);
    console.log(`  folder:  ${folder}`);
    console.log(`  pid:     ${handle.pid}`);
    console.log(`Stop with:  mnt stop`);
  });

program
  .command("stop")
  .description("Stop the active recording and transcribe it")
  .option("--skip-transcribe", "Stop only — don't run Whisper")
  .option("--model <name>", "Whisper model (e.g. tiny.en, small.en, medium.en)")
  .action(async (opts: { skipTranscribe?: boolean; model?: string }) => {
    const session = loadActiveSession();
    if (!session) {
      console.error("No active recording. Start one with:  mnt start");
      process.exit(1);
    }

    console.log(`Stopping recording (pid ${session.pid})...`);
    try {
      await stopRecording(session.pid, session.audio_path);
    } catch (err: any) {
      console.error(`Failed to stop cleanly: ${err.message}`);
      clearActiveSession();
      process.exit(1);
    }

    const endedAt = new Date();
    const durationSec = Math.round(
      (endedAt.getTime() - new Date(session.started_at).getTime()) / 1000
    );

    const { transcriptPath, metadataPath } = createSessionFolder(session.id);

    if (opts.skipTranscribe) {
      writeMetadata(metadataPath, {
        id: session.id,
        title: humanTitle(session.id),
        started_at: session.started_at,
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSec,
        source: session.source,
        audio_path: "audio.wav",
      });
      clearActiveSession();
      console.log(`Recording saved (no transcript).`);
      console.log(`  audio:   ${session.audio_path}`);
      return;
    }

    console.log(`Transcribing with Whisper (this can take a few minutes)...`);
    try {
      const result = await transcribe({
        audioPath: session.audio_path,
        outputPath: transcriptPath,
        meetingTitle: humanTitle(session.id),
        startedAt: session.started_at,
        durationSeconds: durationSec,
        model: opts.model,
      });
      writeMetadata(metadataPath, {
        id: session.id,
        title: humanTitle(session.id),
        started_at: session.started_at,
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSec,
        source: session.source,
        audio_path: "audio.wav",
        transcript_path: "transcript.md",
      });
      clearActiveSession();
      console.log(`Done.`);
      console.log(`  segments: ${result.segmentCount}`);
      console.log(`  words:    ${result.wordCount}`);
      console.log(`  folder:   ${session.folder}`);
      console.log(`  open:     ${transcriptPath}`);
    } catch (err: any) {
      console.error(`Transcription failed: ${err.message}`);
      console.error(`Audio is preserved at: ${session.audio_path}`);
      console.error(`You can retry with:    mnt transcribe "${session.audio_path}"`);
      clearActiveSession();
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show the active recording, if any")
  .action(() => {
    const s = loadActiveSession();
    if (!s) {
      console.log("No active recording.");
      console.log(`Recordings folder:  ${getRoot()}`);
      return;
    }
    const elapsed = Math.round((Date.now() - new Date(s.started_at).getTime()) / 1000);
    console.log(`Recording in progress.`);
    console.log(`  id:       ${s.id}`);
    console.log(`  pid:      ${s.pid}`);
    console.log(`  started:  ${dayjs(s.started_at).format("YYYY-MM-DD HH:mm:ss")}`);
    console.log(`  elapsed:  ${elapsed}s`);
    console.log(`  folder:   ${s.folder}`);
  });

program
  .command("transcribe <audioFile>")
  .description("Transcribe an existing .wav (handy for testing)")
  .option("--model <name>", "Whisper model (default: medium.en)")
  .option("--title <title>", "Title to put in the transcript header", "Test transcription")
  .action(async (audioFile: string, opts: { model?: string; title: string }) => {
    const audioPath = resolve(audioFile);
    if (!existsSync(audioPath)) {
      console.error(`File not found: ${audioPath}`);
      process.exit(1);
    }
    const outputPath = audioPath.replace(/\.[^.]+$/, "") + ".transcript.md";
    console.log(`Transcribing ${audioPath}...`);
    const result = await transcribe({
      audioPath,
      outputPath,
      meetingTitle: opts.title,
      startedAt: new Date().toISOString(),
      model: opts.model,
    });
    console.log(`Done. ${result.segmentCount} segments, ${result.wordCount} words.`);
    console.log(`Output: ${outputPath}`);
  });

/** Turn "2026-05-04T10-30_design-review" into "Design Review — 2026-05-04 10:30". */
function humanTitle(id: string): string {
  const m = id.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})_(.+)$/);
  if (!m) return id;
  const [, date, hh, mm, slug] = m;
  const pretty = slug.split("-").map(cap).join(" ");
  return `${pretty} — ${date} ${hh}:${mm}`;
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

program.parseAsync(process.argv).catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
