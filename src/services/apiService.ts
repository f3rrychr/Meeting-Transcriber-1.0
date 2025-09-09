// API Service for handling OpenAI and Hugging Face integrations
import { TranscriptData, SummaryData, TranscriptSegment, Speaker } from '../types';

export class APIError extends Error {
  constructor(message: string, public code: string = 'API_ERROR', public statusCode?: number, public apiType?: string) {
    super(message);
    this.name = 'APIError';
  }

  toApiResponse(): { ok: false; code: string; message: string } {
    return {
      ok: false,
      code: this.code,
      message: this.message
    };
  }
}

export interface APIKeys {
  openai: string;
  huggingface: string;
}


// Validate API keys
export const validateAPIKeys = (keys: APIKeys): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!keys.openai || !keys.openai.startsWith('sk-')) {
    errors.push('OpenAI API key is invalid. It should start with "sk-"');
  }
  
  if (!keys.huggingface || !keys.huggingface.startsWith('hf_')) {
    errors.push('Hugging Face API key is invalid. It should start with "hf_"');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};