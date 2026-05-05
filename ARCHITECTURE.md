# Meeting Note Taker — Architecture (simple v1)

## What it does

A small background app that records your Zoom meetings and turns them into transcript files. When a meeting ends, you get a notification and the transcript is sitting in a folder, ready to drag into Claude, ChatGPT, Perplexity, or anything else.

That's it. No servers, no databases, no APIs. Just files.

## Stack

- **Node.js + TypeScript** — single language, single repo.
- **`ffmpeg`** — for recording system audio. Shelled out as a child process.
- **`whisper.cpp`** — for transcription. Runs locally on the user's machine.
- **`node-notifier`** — for the "transcript ready" desktop notification.
- **`commander`** — for the CLI.

No frameworks, no Electron (yet), no web UI. Just a Node process.

## How it works

```
Zoom starts                 Zoom ends
    │                          │
    ▼                          ▼
┌────────┐   ┌──────────┐   ┌──────────┐   ┌────────────┐   ┌──────────────┐
│ Detect │──▶│  Record  │──▶│ Stop rec │──▶│ Transcribe │──▶│ Notify user  │
│  Zoom  │   │  audio   │   │          │   │  (Whisper) │   │ (open file)  │
└────────┘   └──────────┘   └──────────┘   └────────────┘   └──────────────┘
                                                                    │
                                                                    ▼
                                                       transcript.md sits in folder.
                                                       User opens it, copies it,
                                                       pastes into Claude / ChatGPT /
                                                       Perplexity. Done.
```

### 1. Detect the meeting

Two modes, user picks one:

**Auto mode** — every few seconds, check if `zoom.us` (macOS) / `Zoom.exe` (Windows) is running. When it appears, start recording. When it exits, stop.

```ts
// macOS example, runs every 5s
const isZoomRunning = await exec("pgrep -x zoom.us").then(() => true).catch(() => false);
```

**Manual mode** — user runs `mnt start` to begin and `mnt stop` to end. Useful when auto-detection misbehaves or for non-Zoom calls.

Start with both. Auto for the polish, manual for the safety net.

### 2. Record the audio

This is the only genuinely tricky part, because operating systems don't let you record system audio out of the box.

- **macOS:** user installs [BlackHole](https://existential.audio/blackhole/) once (free, ~30 sec). Set up a Multi-Output Device that sends audio to both speakers and BlackHole. We capture from BlackHole.
- **Windows:** WASAPI loopback works directly via ffmpeg. No setup.
- **Linux:** PulseAudio monitor source. No setup.

ffmpeg command (macOS, mixing system audio + mic):

```bash
ffmpeg -f avfoundation -i ":BlackHole 2ch" -f avfoundation -i ":default" \
  -filter_complex amix=inputs=2 -ac 1 -ar 16000 \
  ~/MeetingNotes/2026-05-04T10-30/audio.wav
```

We pre-resample to 16 kHz mono because that's what Whisper wants — saves a conversion step and keeps the file small.

We ship a one-time `mnt setup` command that walks the user through BlackHole install on macOS. Documented setup, not auto-magic.

### 3. Transcribe

When recording stops, hand the audio file to `whisper.cpp` (via `nodejs-whisper`):

```ts
const result = await whisper("audio.wav", { model: "medium.en" });
```

Default model: `medium.en` — best balance for meetings. Configurable.

Output: `transcript.md` formatted like:

```markdown
# Meeting — 2026-05-04 10:30

Duration: 54 min
Source: Zoom

---

[00:00:00] Hey everyone, thanks for joining. Let's start with the Q2 roadmap…
[00:01:23] On pricing — I think we should…
```

Plain markdown with timestamps. Readable on its own, perfect for pasting into any AI tool.

### 4. Notify

Native desktop notification: *"Transcript ready — Meeting on 2026-05-04 10:30"*. Click → opens the folder in Finder/Explorer.

```ts
notifier.notify({
  title: "Transcript ready",
  message: "Meeting on 2026-05-04 10:30 (54 min)",
  open: `file://${folderPath}`,
});
```

### 5. Hand off to the AI tool

Three ways, easiest first:

1. **Just open the file.** `transcript.md` is plain text. Drag it into Claude or ChatGPT, or copy-paste into Perplexity. Works everywhere, today.
2. **`mnt copy`** — copies the latest transcript to your clipboard with a prompt prefix like *"Below is a meeting transcript. Please summarize the key decisions and action items.\n\n---\n\n"*. Now `Cmd+V` into any AI tool gives a useful starting prompt.
3. **`mnt copy <id>`** — same but for a specific past meeting (`mnt list` to see them).

That's the entire integration story. No MCP, no plugins, no APIs. The transcript is a file; AI tools already know what to do with files.

## Folder layout

```
~/MeetingNotes/
├── 2026-05-04T10-30_zoom/
│   ├── audio.wav
│   └── transcript.md
├── 2026-05-04T15-00_zoom/
│   ├── audio.wav
│   └── transcript.md
└── …
```

Flat, dated, sortable. No index file, no database. If the user wants to find something they `grep -r "kubernetes" ~/MeetingNotes/` or use Spotlight. Good enough for v1.

## CLI

```
mnt start       # start recording manually
mnt stop        # stop recording, transcribe, notify
mnt watch       # run the auto-detect daemon
mnt list        # list recent meetings
mnt copy [id]   # copy a transcript to clipboard with a prompt prefix
mnt setup       # one-time setup (BlackHole on macOS, etc.)
```

That's the entire surface area.

## Project layout

```
meeting-note-taker/
├── src/
│   ├── cli.ts              # commander entry point
│   ├── detect.ts           # is Zoom running?
│   ├── record.ts           # ffmpeg wrapper
│   ├── transcribe.ts       # whisper wrapper
│   ├── notify.ts           # desktop notifications
│   ├── storage.ts          # folder paths, file naming
│   └── daemon.ts           # the auto-detect loop
├── package.json
├── tsconfig.json
└── README.md
```

Eight files. That's the whole app.

## Build order

**Day 1–2:** `mnt start` / `mnt stop` work end-to-end on macOS. Records audio, runs Whisper, drops `transcript.md` in the folder.

**Day 3:** `mnt watch` auto-detects Zoom and triggers start/stop.

**Day 4:** `mnt list`, `mnt copy`, desktop notifications, `mnt setup` for BlackHole.

**Day 5:** Windows port (it's actually easier — WASAPI loopback works without setup).

A working v1 in a week. Add things only when you actually miss them.

## What we're explicitly *not* building (yet)

- No MCP server. The transcript file in your AI tool of choice is the integration.
- No SQLite index. Folders + filenames are the index.
- No web UI. The OS file browser is the UI.
- No speaker diarization. Timestamps only — Whisper alone doesn't know who's who.
- No cloud sync, no accounts, no settings UI. A `~/.mntrc` JSON file if we need config.

Each of these is a real feature; none of them belong in v1. Ship the boring useful thing first.
