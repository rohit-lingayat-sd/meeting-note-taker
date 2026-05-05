# meeting-note-taker

Records meetings, transcribes them locally with Whisper, and drops a clean
markdown transcript into a folder. From there you paste/drag it into Claude,
ChatGPT, Perplexity, or anything else.

Privacy-focused (audio + transcripts stay on your machine), Node.js + TypeScript.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the design.

---

## M1 — what works today

```
mnt start [--title "..."]   begin recording (default mic)
mnt stop                    stop, transcribe, write transcript.md
mnt status                  show whether a session is active
mnt transcribe <audio.wav>  transcribe an existing wav (testing)
```

Output lands in `~/MeetingNotes/<timestamp>_<slug>/` as:

- `audio.wav` — raw 16 kHz mono recording
- `transcript.md` — readable markdown with `[HH:MM:SS]` line prefixes
- `metadata.json` — title, start/end, duration, source

## Setup (one-time)

```bash
# 1. Install ffmpeg
brew install ffmpeg                  # macOS
# sudo apt install ffmpeg            # Linux
# https://ffmpeg.org/download.html   # Windows

# 2. Install dependencies
npm install

# 3. Build (or skip and run via tsx)
npm run build

# 4. Link the CLI globally (optional)
npm link
# now `mnt` works from anywhere; otherwise use `npm run mnt -- <cmd>`
```

The first `mnt stop` will download the Whisper model (`medium.en`, ~1.5 GB).
Use a smaller model with `--model tiny.en` (75 MB) to test faster.

## Quick test

```bash
mnt start --title "design-review"
# … speak into your mic for 30 seconds …
mnt stop
# → ~/MeetingNotes/2026-05-04T10-30_design-review/transcript.md
```

Then drag `transcript.md` into Claude/ChatGPT/Perplexity and ask whatever you
want about the meeting.

## Configuration (env vars)

| Variable            | Purpose                                        | Default                |
|---------------------|------------------------------------------------|------------------------|
| `MNT_ROOT`          | Where recordings are stored                    | `~/MeetingNotes`       |
| `MNT_WHISPER_MODEL` | Whisper model name                             | `medium.en`            |
| `MNT_AUDIO_INPUT`   | ffmpeg input device override (see below)       | platform default       |

### macOS audio input

By default we record from `:0` (your default mic). To capture **system audio**
(everyone else in the call), install [BlackHole](https://existential.audio/blackhole/),
set up a Multi-Output Device that pipes audio to both your speakers and BlackHole,
then:

```bash
export MNT_AUDIO_INPUT=":BlackHole 2ch"
mnt start
```

Auto-detection of Zoom and the mic+system mix come in M2.

## What's not in M1

- Auto-detect (watching for the Zoom process)
- System-audio capture out of the box
- Desktop notifications
- `mnt list` / `mnt copy` convenience commands

These all land in M2/M3.
