import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config();

export interface Config {
  ffmpegDeviceIndex: string;
  perplexityApiKey: string;
  whisperModel: string;
  recordingsDir: string;
  notesDir: string;
}

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const config: Config = {
    ffmpegDeviceIndex: process.env.FFMPEG_DEVICE_INDEX || ':0',
    perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
    whisperModel: process.env.WHISPER_MODEL || 'base',
    recordingsDir: path.join(process.cwd(), 'recordings'),
    notesDir: path.join(process.cwd(), 'notes'),
  };

  return config;
}

/**
 * Validate required configuration for recording
 */
export function validateRecordConfig(config: Config): void {
  if (!config.ffmpegDeviceIndex) {
    throw new Error('FFMPEG_DEVICE_INDEX is not set. Please configure it in .env file.');
  }
}

/**
 * Validate required configuration for summarization
 */
export function validateSummarizeConfig(config: Config): void {
  if (!config.perplexityApiKey) {
    throw new Error('PERPLEXITY_API_KEY is not set. Please configure it in .env file.');
  }
}
