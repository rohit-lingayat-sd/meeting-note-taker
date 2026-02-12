import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from './config';

/**
 * Generate a filename with timestamp
 */
function generateFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${prefix}-${timestamp}.${extension}`;
}

/**
 * Record audio using ffmpeg with avfoundation
 * @param config - Application configuration
 * @returns Promise resolving to the path of the recorded file
 */
export async function recordAudio(config: Config): Promise<string> {
  // Ensure recordings directory exists
  if (!fs.existsSync(config.recordingsDir)) {
    fs.mkdirSync(config.recordingsDir, { recursive: true });
  }

  const filename = generateFilename('meeting', 'wav');
  const outputPath = path.join(config.recordingsDir, filename);

  console.log('🎙️  Starting audio recording...');
  console.log(`📁 Output file: ${outputPath}`);
  console.log('⏸️  Press Ctrl+C to stop recording\n');

  return new Promise((resolve, reject) => {
    // ffmpeg command to record audio from macOS audio device
    const ffmpegArgs = [
      '-f', 'avfoundation',
      '-i', config.ffmpegDeviceIndex,
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      // Show recording progress
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.includes('size=') || line.includes('time=')) {
          process.stdout.write(`\r${line.trim()}`);
        }
      }
    });

    ffmpeg.on('close', (code) => {
      process.stdout.write('\n');
      if (code === 0 || code === 255) {
        // Code 255 is normal when interrupted with Ctrl+C
        console.log('✅ Recording saved successfully!');
        console.log(`📄 File: ${outputPath}\n`);
        resolve(outputPath);
      } else {
        console.error('❌ Recording failed');
        console.error(stderr);
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      console.error('❌ Failed to start ffmpeg:', error.message);
      console.error('💡 Make sure ffmpeg is installed: brew install ffmpeg');
      reject(error);
    });

    // Handle graceful shutdown on Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n\n⏹️  Stopping recording...');
      ffmpeg.kill('SIGINT');
    });
  });
}
