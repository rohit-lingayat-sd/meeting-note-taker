import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { Config } from './config';

interface PerplexityMessage {
  role: string;
  content: string;
}

interface PerplexityRequest {
  model: string;
  messages: PerplexityMessage[];
}

interface PerplexityResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message: string;
  };
}

/**
 * Call Perplexity API to generate meeting notes
 * @param transcription - The transcribed text
 * @param apiKey - Perplexity API key
 * @returns Promise resolving to the generated notes
 */
async function callPerplexityAPI(transcription: string, apiKey: string): Promise<string> {
  const prompt = `You are an expert meeting note-taker. Generate comprehensive, structured meeting notes from the following transcription.

Include:
- Meeting Summary (2-3 sentences)
- Key Discussion Points (bullet points)
- Action Items (if any, with assignees if mentioned)
- Decisions Made (if any)
- Next Steps (if mentioned)

Transcription:
${transcription}

Please format the output in clean Markdown.`;

  const requestData: PerplexityRequest = {
    model: 'llama-3.1-sonar-small-128k-online',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const data = JSON.stringify(requestData);

  const options = {
    hostname: 'api.perplexity.ai',
    port: 443,
    path: '/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(data),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const response: PerplexityResponse = JSON.parse(responseData);

          if (response.error) {
            reject(new Error(`Perplexity API error: ${response.error.message}`));
            return;
          }

          if (!response.choices || !response.choices[0] || !response.choices[0].message) {
            reject(new Error('Invalid response from Perplexity API'));
            return;
          }

          const content = response.choices[0].message.content;
          if (!content) {
            reject(new Error('Empty response from Perplexity API'));
            return;
          }

          resolve(content);
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API request failed: ${error.message}`));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Generate a filename with timestamp for notes
 */
function generateNotesFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `meeting-${timestamp}.md`;
}

/**
 * Summarize transcription using Perplexity API and save to markdown file
 * @param transcription - The transcribed text
 * @param config - Application configuration
 * @param audioPath - Original audio file path (for reference)
 * @returns Promise resolving to the path of the notes file
 */
export async function summarizeTranscription(
  transcription: string,
  config: Config,
  audioPath: string
): Promise<string> {
  console.log('🤖 Generating meeting notes with Perplexity AI...\n');

  try {
    // Call Perplexity API
    const notes = await callPerplexityAPI(transcription, config.perplexityApiKey);

    // Ensure notes directory exists
    if (!fs.existsSync(config.notesDir)) {
      fs.mkdirSync(config.notesDir, { recursive: true });
    }

    // Generate filename and save notes
    const filename = generateNotesFilename();
    const notesPath = path.join(config.notesDir, filename);

    // Add metadata header to notes
    const fullNotes = `# Meeting Notes
**Generated:** ${new Date().toISOString()}  
**Audio File:** ${path.basename(audioPath)}  
**Transcription Length:** ${transcription.length} characters

---

${notes}

---

## Full Transcription
${transcription}
`;

    fs.writeFileSync(notesPath, fullNotes, 'utf-8');

    console.log('✅ Meeting notes generated successfully!');
    console.log(`📄 Notes saved to: ${notesPath}\n`);

    return notesPath;
  } catch (error) {
    console.error('❌ Failed to generate notes:', error);
    throw error;
  }
}
