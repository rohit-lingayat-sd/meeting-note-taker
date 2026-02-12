#!/usr/bin/env node

import * as path from 'path';
import { loadConfig, validateRecordConfig, validateSummarizeConfig } from './config';
import { recordAudio } from './record';
import { transcribeAudio } from './transcribe';
import { summarizeTranscription } from './summarize';

/**
 * Display help message
 */
function showHelp(): void {
  console.log(`
Meeting Note Taker CLI
======================

Usage:
  npm run record                    Record a meeting audio
  npm run summarize <audio-file>    Transcribe and summarize a recording

Commands:
  record      Start recording audio from your microphone
              Press Ctrl+C to stop recording
  
  summarize   Transcribe an audio file and generate meeting notes
              Requires: audio file path as argument

Environment Variables:
  FFMPEG_DEVICE_INDEX     Audio device index for recording (default: :0)
  PERPLEXITY_API_KEY      API key for Perplexity AI
  WHISPER_MODEL           Whisper model size: tiny|base|small|medium|large (default: base)

Examples:
  npm run record
  npm run summarize recordings/meeting-2024-01-15T10-30-00.wav

Configuration:
  Copy .env.example to .env and configure your settings
`);
}

/**
 * Handle the record command
 */
async function handleRecord(): Promise<void> {
  try {
    const config = loadConfig();
    validateRecordConfig(config);

    console.log('\n========================================');
    console.log('  Meeting Note Taker - Record Audio');
    console.log('========================================\n');

    const audioPath = await recordAudio(config);
    
    console.log('🎉 Recording complete!');
    console.log('\n📋 Next steps:');
    console.log(`   npm run summarize ${audioPath}\n`);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Handle the summarize command
 */
async function handleSummarize(audioPath: string): Promise<void> {
  try {
    const config = loadConfig();
    validateSummarizeConfig(config);

    console.log('\n========================================');
    console.log('  Meeting Note Taker - Summarize');
    console.log('========================================\n');

    // Resolve audio path
    const resolvedPath = path.isAbsolute(audioPath) 
      ? audioPath 
      : path.join(process.cwd(), audioPath);

    // Step 1: Transcribe
    const transcription = await transcribeAudio(resolvedPath, config);

    // Step 2: Summarize
    const notesPath = await summarizeTranscription(transcription, config, resolvedPath);

    console.log('🎉 Process complete!');
    console.log('\n📋 Summary:');
    console.log(`   Audio: ${resolvedPath}`);
    console.log(`   Notes: ${notesPath}\n`);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  switch (command) {
    case 'record':
      await handleRecord();
      break;

    case 'summarize':
      if (args.length < 2) {
        console.error('❌ Error: Audio file path is required');
        console.log('\nUsage: npm run summarize <audio-file>\n');
        process.exit(1);
      }
      await handleSummarize(args[1]);
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

// Run the CLI
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
