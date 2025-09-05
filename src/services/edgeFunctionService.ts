// Edge Function Service for real API calls through Supabase
import { TranscriptData, SummaryData } from '../types';
import { StandardError } from '../types';
import { AudioProcessor } from '../utils/audioUtils';
import { retryWithBackoff, parseRetryAfter, RetryableError } from '../utils/retryUtils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface ProgressCallback {
  (phase: 'upload' | 'processing' | 'transcription' | 'summary', 
   percentage: number, 
   message: string, 
   details?: { 
     bytesUploaded?: number; 
     totalBytes?: number; 
     chunksReceived?: number; 
     totalChunks?: number;
     isIndeterminate?: boolean;
     retryAttempt?: number;
     retryCountdown?: number;
   }): void;
}

export interface ProgressCallback {
  (phase: 'upload' | 'processing' | 'transcription' | 'summary', 
   percentage: number, 
   message: string, 
   details?: { bytesUploaded?: number; totalBytes?: number; chunksReceived?: number; totalChunks?: number }): void;
}

export class EdgeFunctionError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'EdgeFunctionError';
  }

  toStandardError(): StandardError {
    return {
      error: this.message,
      statusCode: this.statusCode,
      apiType: 'supabase',
    };
  }
}

export const transcribeAudioViaEdgeFunction = async (
  file: File, 
  apiKey: string, 
  onProgress?: ProgressCallback
): Promise<TranscriptData> => {
  file: File, 
  apiKey: string, 
  onProgress?: ProgressCallback
): Promise<TranscriptData> => {
  console.log('transcribeAudioViaEdgeFunction called with file:', file.name, 'size:', file.size);
  
  if (!SUPABASE_URL) {
    throw new EdgeFunctionError('Supabase URL not configured. Please click "Connect to Supabase" in the top right to set up your Supabase connection.');
  }

  if (!SUPABASE_ANON_KEY) {
    throw new EdgeFunctionError('Supabase anonymous key not configured. Please set up your Supabase connection.');
  }

  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new EdgeFunctionError('Invalid OpenAI API key. Key should start with "sk-"');
  }

  // Log file size for processing
  console.log(`Processing file: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`);
  
  // Initialize progress
  onProgress?.('upload', 0, 'Preparing upload...', { totalBytes: file.size });
  
  // Initialize progress
  onProgress?.('upload', 0, 'Preparing upload...', { totalBytes: file.size });
  
  // Retry wrapper for the entire transcription operation
  return retryWithBackoff(
    () => performTranscriptionRequest(file, apiKey, onProgress),
    {
      maxRetries: 3,
      baseDelay: 2000,
      maxDelay: 30000,
      retryableStatusCodes: [429, 500, 502, 503, 504],
      onRetry: (attempt, delay, error) => {
        console.log(`Transcription attempt ${attempt} failed, retrying in ${delay}ms:`, error);
        onProgress?.('processing', 0, `Attempt ${attempt} failed, retrying...`, {
          isIndeterminate: true,
          retryAttempt: attempt
        });
      },
      onCountdown: (remainingSeconds) => {
        onProgress?.('processing', 0, `Retrying in ${remainingSeconds}s...`, {
          isIndeterminate: true,
          retryCountdown: remainingSeconds
        });
      }
    }
  );
};

/**
 * Perform the actual transcription request
 */
const performTranscriptionRequest = async (
  file: File,
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<TranscriptData> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('apiKey', apiKey);

  const apiUrl = `${SUPABASE_URL}/functions/v1/transcribe-audio`;
  
  console.log('Sending request to edge function:', apiUrl);

  // Create XMLHttpRequest for upload progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        onProgress?.('upload', percentage, 'Uploading audio file...', {
          bytesUploaded: event.loaded,
          totalBytes: event.total
        });
      }
    });
    
    // Handle upload completion
    xhr.upload.addEventListener('load', () => {
      onProgress?.('processing', 0, 'Upload complete, processing on server...', { isIndeterminate: true });
    });
    
    // Handle response
    xhr.addEventListener('load', () => {
      console.log('Edge function response status:', xhr.status);
      
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          onProgress?.('transcription', 50, 'Transcribing audio with OpenAI Whisper...');
          
          const transcriptData = JSON.parse(xhr.responseText);
          console.log('Transcription completed via edge function:', transcriptData);
          
          onProgress?.('transcription', 100, 'Transcription complete!');
          resolve(transcriptData as TranscriptData);
        } catch (parseError) {
          console.error('Failed to parse transcription response:', parseError);
          reject(new EdgeFunctionError('Failed to parse transcription response'));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          console.error('Edge function error response:', errorData);
          
          // Parse Retry-After header for 429 responses
          const retryAfter = xhr.status === 429 ? parseRetryAfter(xhr.getResponseHeader('Retry-After')) : undefined;
          
          const error = new EdgeFunctionError(
            errorData.error || `HTTP ${xhr.status}: ${xhr.statusText}`,
            xhr.status
          );
          
          // Add retry information for retryable errors
          if ([429, 500, 502, 503, 504].includes(xhr.status)) {
            (error as any).retryAfter = retryAfter;
          }
          
          reject(error);
        } catch (parseError) {
          const error = new EdgeFunctionError(`HTTP ${xhr.status}: ${xhr.statusText}`, xhr.status);
          if ([429, 500, 502, 503, 504].includes(xhr.status)) {
            const retryAfter = parseRetryAfter(xhr.getResponseHeader('Retry-After'));
            (error as any).retryAfter = retryAfter;
          }
          reject(error);
        }
      }
    });
    
    // Handle network errors
    xhr.addEventListener('error', () => {
      console.error('Network error during transcription request');
      reject(new EdgeFunctionError('Network error: Unable to connect to Supabase edge function. Please check your Supabase connection and try again.'));
    });
    
    // Handle timeout
    xhr.addEventListener('timeout', () => {
      console.error('Request timeout during transcription');
      reject(new EdgeFunctionError('Request timed out. Please try with a smaller file or check your connection.'));
    });
    
    // Configure and send request
    xhr.open('POST', apiUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    xhr.timeout = 600000; // 10 minute timeout
    xhr.send(formData);
  });
};
  
  /* Original fetch-based implementation - keeping as fallback
  // Create XMLHttpRequest for upload progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        onProgress?.('upload', percentage, 'Uploading audio file...', {
          bytesUploaded: event.loaded,
          totalBytes: event.total
        });
      }
    });
    
    // Handle upload completion
    xhr.upload.addEventListener('load', () => {
      onProgress?.('processing', 0, 'Upload complete, processing on server...', { isIndeterminate: true });
    });
    
    // Handle response
    xhr.addEventListener('load', () => {
      console.log('Edge function response status:', xhr.status);
      
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          onProgress?.('transcription', 50, 'Transcribing audio with OpenAI Whisper...');
          
          const transcriptData = JSON.parse(xhr.responseText);
          console.log('Transcription completed via edge function:', transcriptData);
          
          onProgress?.('transcription', 100, 'Transcription complete!');
          resolve(transcriptData as TranscriptData);
        } catch (parseError) {
          console.error('Failed to parse transcription response:', parseError);
          reject(new EdgeFunctionError('Failed to parse transcription response'));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          console.error('Edge function error response:', errorData);
          
          if (xhr.status === 401) {
            reject(new EdgeFunctionError('Invalid OpenAI API key. Please check your API key in Settings.', 401));
          } else if (xhr.status === 413) {
            reject(new EdgeFunctionError('File too large. Please try with a smaller audio file.', 413));
          } else {
            reject(new EdgeFunctionError(errorData.error || 'Edge function error occurred', xhr.status));
          }
        } catch (parseError) {
          reject(new EdgeFunctionError(`HTTP ${xhr.status}: ${xhr.statusText}`, xhr.status));
        }
      }
    });
    
    // Handle network errors
    xhr.addEventListener('error', () => {
      console.error('Network error during transcription request');
      reject(new EdgeFunctionError('Network error: Unable to connect to Supabase edge function. Please check your Supabase connection and try again.'));
    });
    
    // Handle timeout
    xhr.addEventListener('timeout', () => {
      console.error('Request timeout during transcription');
      reject(new EdgeFunctionError('Request timed out. Please try with a smaller file or check your connection.'));
    });
    
    // Configure and send request
    xhr.open('POST', apiUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    xhr.timeout = 600000; // 10 minute timeout
    xhr.send(formData);
  });
  
  /* Original fetch-based implementation - keeping as fallback
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: formData,
    });

    console.log('Edge function response status:', response.status);
    console.log('Edge function response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Edge function error response:', errorData);
      
      if (response.status === 401) {
        throw new EdgeFunctionError('Invalid OpenAI API key. Please check your API key in Settings.', 401);
      }
      
      if (response.status === 413) {
        throw new EdgeFunctionError('File too large. Please try with a smaller audio file.', 413);
      }
      
      throw new EdgeFunctionError(
        errorData.error || 'Edge function error occurred',
        response.status
      );
    }

    const transcriptData = await response.json();
    console.log('Transcription completed via edge function:', transcriptData);
    
    return transcriptData as TranscriptData;
  } catch (error) {
    console.error('Error calling transcription edge function:', error);
    
    if (error instanceof EdgeFunctionError) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new EdgeFunctionError('Network error: Unable to connect to Supabase edge function. Please check your Supabase connection and try again.');
    }
    
    throw new EdgeFunctionError(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const generateSummaryViaEdgeFunction = async (
export const generateSummaryViaEdgeFunction = async (
  transcript: TranscriptData, 
  apiKey: string, 
  onProgress?: ProgressCallback
): Promise<SummaryData> => {
  apiKey: string, 
  onProgress?: ProgressCallback
): Promise<SummaryData> => {
  console.log('generateSummaryViaEdgeFunction called');
  
  if (!SUPABASE_URL) {
    throw new EdgeFunctionError('Supabase URL not configured. Please click "Connect to Supabase" in the top right to set up your Supabase connection.');
  }

  if (!SUPABASE_ANON_KEY) {
    throw new EdgeFunctionError('Supabase anonymous key not configured. Please set up your Supabase connection.');
  }

  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new EdgeFunctionError('Invalid OpenAI API key for summary generation');
  }

  if (!transcript || !transcript.speakers || transcript.speakers.length === 0) {
    throw new EdgeFunctionError('Invalid transcript data for summary generation');
  }

  onProgress?.('summary', 0, 'Generating summary with GPT...');
  
  onProgress?.('summary', 0, 'Generating summary with GPT...');
  
  // Retry wrapper for summary generation
  return retryWithBackoff(
    () => performSummaryRequest(transcript, apiKey, onProgress),
    {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 20000,
      retryableStatusCodes: [429, 500, 502, 503, 504],
      onRetry: (attempt, delay, error) => {
        console.log(`Summary attempt ${attempt} failed, retrying in ${delay}ms:`, error);
        onProgress?.('summary', 0, `Attempt ${attempt} failed, retrying...`, {
          isIndeterminate: true,
          retryAttempt: attempt
        });
      },
      onCountdown: (remainingSeconds) => {
        onProgress?.('summary', 0, `Retrying in ${remainingSeconds}s...`, {
          isIndeterminate: true,
          retryCountdown: remainingSeconds
        });
      }
    }
  );
};

/**
 * Perform the actual summary generation request
 */
const performSummaryRequest = async (
  transcript: TranscriptData,
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<SummaryData> => {
  const apiUrl = `${SUPABASE_URL}/functions/v1/generate-summary`;
  
  console.log('Sending summary request to edge function:', apiUrl);

  onProgress?.('summary', 25, 'Sending transcript to AI...');
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transcript,
      apiKey,
    }),
  });

  console.log('Summary edge function response status:', response.status);
  onProgress?.('summary', 75, 'Processing AI response...');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('Summary edge function error:', errorData);
    
    // Parse Retry-After header for 429 responses
    const retryAfter = response.status === 429 ? parseRetryAfter(response.headers.get('Retry-After')) : undefined;
    
    const error = new EdgeFunctionError(
      errorData.error || 'Summary generation error occurred',
      response.status
    );
    
    // Add retry information for retryable errors
    if ([429, 500, 502, 503, 504].includes(response.status)) {
      (error as any).retryAfter = retryAfter;
    }
    
    throw error;
  }

  const summaryData = await response.json();
  console.log('Summary completed via edge function:', summaryData);
  
  onProgress?.('summary', 100, 'Summary generation complete!');
  return summaryData as SummaryData;
};

export const checkSupabaseConnection = (): boolean => {
  // Check if environment variables exist and aren't placeholder values
  const hasUrl = SUPABASE_URL && 
    SUPABASE_URL !== 'your_supabase_project_url' && 
    SUPABASE_URL !== 'undefined' &&
    SUPABASE_URL !== 'null' &&
    !SUPABASE_URL.includes('your_') &&
    !SUPABASE_URL.includes('placeholder') &&
    SUPABASE_URL.startsWith('https://');
  
  const hasKey = SUPABASE_ANON_KEY && 
    SUPABASE_ANON_KEY !== 'your_supabase_anon_key' && 
    SUPABASE_ANON_KEY !== 'undefined' &&
    SUPABASE_ANON_KEY !== 'null' &&
    !SUPABASE_ANON_KEY.includes('your_') &&
    !SUPABASE_ANON_KEY.includes('placeholder') &&
    SUPABASE_ANON_KEY.startsWith('eyJ');
  
  return !!(hasUrl && hasKey);
};