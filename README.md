# Meeting Note Taker

CLI tool to record meeting audio → transcribe with Whisper → generate structured notes with Perplexity AI.

Privacy-focused, works with Zoom/Meet/Teams, built with Node.js + TypeScript.

## Features

- 🎙️ **Record Audio**: Capture meeting audio using ffmpeg with avfoundation
- 🎧 **Transcribe**: Convert speech to text using Whisper AI
- 🤖 **Smart Notes**: Generate structured meeting notes with Perplexity AI
- 📝 **Markdown Output**: Clean, formatted notes with action items and decisions
- 🔒 **Privacy-First**: All processing happens locally except Perplexity API call

## Prerequisites

- **Node.js** 18+ and npm
- **ffmpeg** with avfoundation support (macOS)
  ```bash
  brew install ffmpeg
  ```
- **Perplexity API Key** - Get from [perplexity.ai](https://www.perplexity.ai/)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/rohit-lingayat-sd/meeting-note-taker.git
   cd meeting-note-taker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your settings:
   ```env
   FFMPEG_DEVICE_INDEX=:0
   PERPLEXITY_API_KEY=your_api_key_here
   WHISPER_MODEL=base
   ```

## Usage

### 1. Record a Meeting

Start recording audio from your microphone:

```bash
npm run record
```

Press `Ctrl+C` to stop recording. Audio will be saved to `recordings/meeting-*.wav`

### 2. Generate Meeting Notes

Transcribe and summarize a recorded meeting:

```bash
npm run summarize recordings/meeting-2024-01-15T10-30-00.wav
```

This will:
1. Transcribe the audio using Whisper
2. Generate structured notes using Perplexity AI
3. Save markdown notes to `notes/meeting-*.md`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FFMPEG_DEVICE_INDEX` | Audio device index for recording | `:0` |
| `PERPLEXITY_API_KEY` | Perplexity API key (required for summarization) | - |
| `WHISPER_MODEL` | Whisper model size (tiny, base, small, medium, large) | `base` |

### Finding Your Audio Device

To list available audio devices on macOS:

```bash
ffmpeg -f avfoundation -list_devices true -i ""
```

Use the index shown for your microphone (e.g., `:0`, `:1`) as `FFMPEG_DEVICE_INDEX`.

## Project Structure

```
meeting-note-taker/
├── src/
│   ├── cli.ts          # Main CLI entry point
│   ├── config.ts       # Configuration management
│   ├── record.ts       # Audio recording with ffmpeg
│   ├── transcribe.ts   # Whisper transcription
│   └── summarize.ts    # Perplexity AI summarization
├── recordings/         # Recorded audio files (gitignored)
├── notes/             # Generated meeting notes (gitignored)
├── package.json
├── tsconfig.json
└── .env               # Environment configuration (gitignored)
```

## Output Format

Meeting notes include:

- **Meeting Summary**: Brief overview (2-3 sentences)
- **Key Discussion Points**: Main topics covered
- **Action Items**: Tasks identified with assignees (if mentioned)
- **Decisions Made**: Key decisions from the meeting
- **Next Steps**: Follow-up actions
- **Full Transcription**: Complete text transcript

## Development

Build the project:

```bash
npm run build
```

The TypeScript code will be compiled to the `dist/` directory.

## Troubleshooting

### "ffmpeg not found"

Install ffmpeg:
```bash
brew install ffmpeg
```

### "PERPLEXITY_API_KEY is not set"

Make sure you've created a `.env` file and added your API key:
```env
PERPLEXITY_API_KEY=your_actual_api_key
```

### Recording produces no audio

Check your device index:
```bash
ffmpeg -f avfoundation -list_devices true -i ""
```

Update `FFMPEG_DEVICE_INDEX` in `.env` with the correct device.

## License

MIT
