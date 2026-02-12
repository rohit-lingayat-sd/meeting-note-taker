import * as fs from 'fs';
import * as path from 'path';
import { Config } from './config';

/**
 * Transcribe audio file using Whisper
 * @param audioPath - Path to the audio file
 * @param config - Application configuration
 * @returns Promise resolving to the transcription text
 */
export async function transcribeAudio(audioPath: string, config: Config): Promise<string> {
  console.log('🎧 Starting transcription with Whisper...');
  console.log(`📝 Model: ${config.whisperModel}`);
  console.log(`📁 Audio file: ${audioPath}\n`);

  // Verify audio file exists
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  try {
    // Dynamically import whisper-node (it's a CommonJS module)
    const whisperModule = await import('whisper-node');
    const whisper = whisperModule.default;

    const options = {
      modelName: config.whisperModel,
      whisperOptions: {
        outputInText: false,
        outputInVtt: false,
        outputInSrt: false,
        outputInCsv: false,
        wordTimestamps: false,
        timestamps_length: 60,
      },
    };

    console.log('⏳ Transcribing (this may take a few minutes)...\n');

    const transcript = await whisper(audioPath, options);

    // Extract text from segments
    let fullText = '';
    if (transcript && transcript[0] && transcript[0].segments) {
      for (const segment of transcript[0].segments) {
        fullText += segment.speech + ' ';
      }
    }

    fullText = fullText.trim();

    if (!fullText) {
      throw new Error('Transcription resulted in empty text');
    }

    console.log('✅ Transcription completed!');
    console.log(`📊 Length: ${fullText.length} characters\n`);

    return fullText;
  } catch (error) {
    console.error('❌ Transcription failed:', error);
    throw error;
  }
}
