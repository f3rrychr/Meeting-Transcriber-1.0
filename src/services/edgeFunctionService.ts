// Edge Function Service for real API calls through Supabase
import { TranscriptData, SummaryData } from '../types';
import { StandardError } from '../types';
import { streamFileUpload, validateFileStream, StreamError } from '../utils/streamUtils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface ProgressCallback {
  (phase: 'upload' | 'processing' | 'transcription' | 'summary', 
   percentage: number, 
   message: string, 
   details?: { bytesUploaded?: number; totalBytes?: number; chunksReceived?: number; totalChunks?: number }): void;
}

interface UploadResponse {
  uploadId: string;
  storagePath: string;
  fileSize: number;
  fileName: string;
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

export const uploadAudioToStorage = async (
  file: File,
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<UploadResponse> => {
  console.log('uploadAudioToStorage called with file:', file.name, 'size:', file.size);
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new EdgeFunctionError('Supabase connection not configured');
  }

  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new EdgeFunctionError('Invalid OpenAI API key');
  }

  const apiUrl = `${SUPABASE_URL}/functions/v1/upload-audio`;
  
  onProgress?.('upload', 0, 'Uploading to Supabase Storage...', { totalBytes: file.size });
  
  try {
    const response = await streamFileUpload(file, apiUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apiKey': apiKey
      },
      onProgress: (bytesUploaded, totalBytes) => {
        const percentage = Math.round((bytesUploaded / totalBytes) * 100);
        onProgress?.('upload', percentage, 'Uploading to storage...', {
          bytesUploaded,
          totalBytes
        });
      },
      maxFileSize: 500 * 1024 * 1024,
      timeout: 600000
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new EdgeFunctionError(errorData.error || 'Upload failed', response.status);
    }
    
    const uploadResponse = await response.json() as UploadResponse;
    onProgress?.('upload', 100, 'Upload complete!');
    
    return uploadResponse;
    
  } catch (error) {
    if (error instanceof StreamError) {
      if (error.code === 'FILE_TOO_LARGE') {
        throw new EdgeFunctionError(error.message, 413);
      } else if (error.code === 'NETWORK_ERROR') {
        throw new RetryableError('Network error during upload', undefined);
      } else if (error.code === 'TIMEOUT') {
        throw new RetryableError('Upload timeout', undefined);
      }
      throw new EdgeFunctionError(error.message);
    }
    throw error;
  }
};

export const transcribeFromStorage = async (
  uploadResponse: UploadResponse,
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<TranscriptData> => {
  console.log('transcribeFromStorage called for upload:', uploadResponse.uploadId);
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new EdgeFunctionError('Supabase connection not configured');
  }

  const apiUrl = `${SUPABASE_URL}/functions/v1/transcribe-chunked`;
  
  onProgress?.('processing', 0, 'Starting server-side transcription...', { isIndeterminate: true });
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadId: uploadResponse.uploadId,
        storagePath: uploadResponse.storagePath,
        apiKey: apiKey,
        chunkSize: 300, // 5 minutes per chunk
        maxChunkSize: 25 * 1024 * 1024 // 25MB max chunk size
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new EdgeFunctionError(errorData.error || 'Transcription failed', response.status);
    }

    onProgress?.('transcription', 75, 'Processing transcription chunks...');
    
    const transcriptData = await response.json();
    
export const transcribeAudioViaEdgeFunction = async (
  file: File, 
  apiKey: string, 
  onProgress?: ProgressCallback
): Promise<TranscriptData> => {
  console.log('transcribeAudioViaEdgeFunction called with file:', file.name, 'size:', file.size);
  
  // Validate file without loading into memory
  const validation = await validateFileStream(file);
  if (!validation.isValid) {
    throw new EdgeFunctionError(validation.error || 'File validation failed');
  }
  
  console.log('File validation passed:', validation.fileInfo);
  
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
  
  const apiUrl = `${SUPABASE_URL}/functions/v1/transcribe-audio`;
  
  console.log('Sending request to edge function:', apiUrl);
  
  // Initialize progress
  onProgress?.('upload', 0, 'Preparing streamed upload...', { totalBytes: file.size });
  
  // Use retry logic with exponential backoff
  return retryWithBackoff(async () => {
    try {
      // Use streamed upload instead of loading entire file into memory
      const response = await streamFileUpload(file, apiUrl, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apiKey': apiKey
        },
        onProgress: (bytesUploaded, totalBytes) => {
          const percentage = Math.round((bytesUploaded / totalBytes) * 100);
          onProgress?.('upload', percentage, 'Streaming audio file...', {
            bytesUploaded,
            totalBytes
          });
        },
        maxFileSize: 500 * 1024 * 1024, // 500MB limit
        timeout: 600000 // 10 minutes
      });
      
      // Upload complete, now processing
      onProgress?.('processing', 0, 'Upload complete, processing on server...', { isIndeterminate: true });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Edge function error response:', errorData);
        
        if (response.status === 401) {
          throw new EdgeFunctionError('Invalid OpenAI API key. Please check your API key in Settings.', 401);
        } else if (response.status === 413) {
          throw new EdgeFunctionError('File too large. Please try with a smaller audio file.', 413);
        } else {
          // Create retryable error for 429/5xx
          const error = new RetryableError(
            errorData.error || 'Edge function error occurred',
            response.status,
            response.headers.get('Retry-After') ? parseInt(response.headers.get('Retry-After')!) * 1000 : undefined
          );
          throw error;
        }
      }
      
      onProgress?.('transcription', 50, 'Transcribing audio with OpenAI Whisper...');
      
      const transcriptData = await response.json();
      console.log('Transcription completed via edge function:', transcriptData);
      
      onProgress?.('transcription', 100, 'Transcription complete!');
      return transcriptData as TranscriptData;
      
    } catch (error) {
      if (error instanceof StreamError) {
        if (error.code === 'FILE_TOO_LARGE') {
          throw new EdgeFunctionError(error.message, 413);
        } else if (error.code === 'NETWORK_ERROR') {
          throw new RetryableError('Network error during upload', undefined);
        } else if (error.code === 'TIMEOUT') {
          throw new RetryableError('Upload timeout', undefined);
        }
        throw new EdgeFunctionError(error.message);
      }
      throw error;
    }
  }, {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    retryableStatusCodes: [429, 500, 502, 503, 504],
    onRetry: (attempt, delay, error) => {
      console.log(`Transcription retry attempt ${attempt}, waiting ${delay}ms:`, error.message);
      onProgress?.('upload', 0, `Retry attempt ${attempt}/4`, { 
        isIndeterminate: true,
        retryAttempt: attempt
      });
    },
    onCountdown: (remainingSeconds) => {
      onProgress?.('upload', 0, `Retrying in ${remainingSeconds} seconds...`, { 
        isIndeterminate: true,
        retryCountdown: remainingSeconds
      });
    }
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
  */
};

export const generateSummaryViaEdgeFunction = async (
  transcript: TranscriptData, 
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
  
  const apiUrl = `${SUPABASE_URL}/functions/v1/generate-summary`;
  
  console.log('Sending summary request to edge function:', apiUrl);

  try {
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
      
      if (response.status === 401) {
        throw new EdgeFunctionError('Invalid OpenAI API key. Please check your API key in Settings.', 401);
      }
      
      throw new EdgeFunctionError(
        errorData.error || 'Summary generation error occurred',
        response.status
      );
    }

    const summaryData = await response.json();
    console.log('Summary completed via edge function:', summaryData);
    
    onProgress?.('summary', 100, 'Summary generation complete!');
    return summaryData as SummaryData;
  } catch (error) {
    console.error('Error calling summary edge function:', error);
    
    if (error instanceof EdgeFunctionError) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new EdgeFunctionError('Network error: Unable to connect to Supabase edge function. Please check your Supabase connection and try again.');
    }
    
    throw new EdgeFunctionError(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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