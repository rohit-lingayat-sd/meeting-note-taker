declare module 'whisper-node' {
  interface WhisperOptions {
    modelName: string;
    whisperOptions?: {
      outputInText?: boolean;
      outputInVtt?: boolean;
      outputInSrt?: boolean;
      outputInCsv?: boolean;
      translateToEnglish?: boolean;
      language?: string;
      wordTimestamps?: boolean;
      timestamps_length?: number;
    };
  }

  interface WhisperSegment {
    start: string;
    end: string;
    speech: string;
  }

  interface WhisperOutput {
    segments?: WhisperSegment[];
  }

  function whisper(
    filePath: string,
    options: WhisperOptions
  ): Promise<WhisperOutput[]>;

  export default whisper;
}
