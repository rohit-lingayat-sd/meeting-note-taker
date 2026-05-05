/**
 * Audio recording via ffmpeg.
 *
 * `startRecording` spawns ffmpeg detached so `mnt start` can exit while the
 * recording continues. We save the PID; `mnt stop` sends SIGINT to ffmpeg,
 * which finalizes the WAV file cleanly.
 *
 * Audio is captured at 16 kHz mono — Whisper's native rate, smallest file.
 *
 * Input device by platform (override with MNT_AUDIO_INPUT):
 *   macOS:   avfoundation, ":0"   (default microphone)
 *            For system audio install BlackHole and set MNT_AUDIO_INPUT=":BlackHole 2ch"
 *   Linux:   pulse, "default"
 *   Windows: dshow, "audio=Microphone"
 */

import { spawn } from "node:child_process";
import { platform } from "node:os";
import { existsSync, statSync } from "node:fs";

export interface RecordingHandle {
  pid: number;
  audioPath: string;
}

interface InputSpec {
  format: string;
  device: string;
}

function inputForPlatform(): InputSpec {
  const override = process.env.MNT_AUDIO_INPUT;
  switch (platform()) {
    case "darwin":
      return { format: "avfoundation", device: override ?? ":0" };
    case "linux":
      return { format: "pulse", device: override ?? "default" };
    case "win32":
      return { format: "dshow", device: override ?? "audio=Microphone" };
    default:
      throw new Error(`Unsupported platform: ${platform()}`);
  }
}

/** Spawn ffmpeg in the background and return its PID. */
export function startRecording(audioPath: string): RecordingHandle {
  const { format, device } = inputForPlatform();

  const args = [
    "-y",                 // overwrite output if it exists
    "-f", format,
    "-i", device,
    "-ac", "1",           // mono
    "-ar", "16000",       // 16 kHz sample rate (Whisper's native)
    "-c:a", "pcm_s16le",  // standard 16-bit PCM WAV
    audioPath,
  ];

  const child = spawn("ffmpeg", args, {
    detached: true,
    stdio: "ignore",      // detach from parent stdio so mnt can exit
  });

  if (!child.pid) {
    throw new Error("Failed to spawn ffmpeg — is it installed and on PATH?");
  }

  child.unref(); // let the parent process exit independently

  return { pid: child.pid, audioPath };
}

/**
 * Send SIGINT to ffmpeg so it writes the trailer and exits cleanly.
 * Wait briefly for the audio file to appear and stop growing, so the caller
 * knows it's safe to transcribe.
 */
export async function stopRecording(pid: number, audioPath: string): Promise<void> {
  try {
    process.kill(pid, "SIGINT");
  } catch (err: any) {
    if (err.code === "ESRCH") {
      // process already gone — proceed if file exists
    } else {
      throw err;
    }
  }

  // Wait up to ~5s for the file to settle (size unchanged for two consecutive checks).
  let lastSize = -1;
  for (let i = 0; i < 25; i++) {
    await sleep(200);
    if (!existsSync(audioPath)) continue;
    const size = statSync(audioPath).size;
    if (size > 0 && size === lastSize) return;
    lastSize = size;
  }

  if (!existsSync(audioPath) || statSync(audioPath).size === 0) {
    throw new Error(`Recording produced no audio at ${audioPath}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Quick check that ffmpeg is on PATH; returns version string or throws. */
export function checkFfmpeg(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-version"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (b) => (out += b.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited with code ${code}`));
      const firstLine = out.split("\n")[0]?.trim() ?? "";
      resolve(firstLine);
    });
  });
}
