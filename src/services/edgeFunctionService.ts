// Edge Function Service for real API calls through Supabase
import { TranscriptData, SummaryData } from '../types';
import { ApiResponse } from '../types';
import { streamFileUpload, validateFileStream, StreamError } from '../utils/streamUtils';
import { ResumableUploadService, ResumableUploadResult } from './resumableUploadService';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Get limits from environment variables with fallbacks
const getFileSizeLimit = (): number => {
  const envLimit = import.meta.env.VITE_MAX_FILE_SIZE_MB;
  return envLimit ? parseInt(envLimit) * 1024 * 1024 : 500 * 1024 * 1024; // Default 500MB
};

const getDurationLimit = (): number => {
  const envLimit = import.meta.env.VITE_MAX_DURATION_MINUTES;
  return envLimit ? parseInt(envLimit) : 180; // Default 180 minutes (3 hours)
};

const getOpenAIChunkLimit = (): number => {
  const envLimit = import.meta.env.VITE_OPENAI_CHUNK_SIZE_MB;
  return envLimit ? parseInt(envLimit) * 1024 * 1024 : 25 * 1024 * 1024; // Default 25MB
};

// File size threshold for resumable uploads (50MB)
const RESUMABLE_UPLOAD_THRESHOLD = 50 * 1024 * 1024;
export interface ProgressCallback {
  (progressState: {
    stage: 'validating' | 'compressing' | 'uploading' | 'transcribing' | 'summarizing' | 'saving' | 'complete';
    percentage: number;
    message: string;
    stageProgress?: number;
    completedStages?: string[];
    totalStages?: number;
    currentStageIndex?: number;
    bytesUploaded?: number;
    totalBytes?: number;
    chunksReceived?: number;
    totalChunks?: number;
    isIndeterminate?: boolean;
    retryAttempt?: number;
    retryCountdown?: number;
  }): void;
}

interface UploadResponse {
  uploadId: string;
  storagePath: string;
  fileSize: number;
  fileName: string;
}

interface UploadResponse {
  uploadId: string;
  storagePath: string;
  fileSize: number;
  fileName: string;
}

export class EdgeFunctionError extends Error {
  constructor(message: string, public code: string = 'EDGE_FUNCTION_ERROR', public statusCode?: number) {
    super(message);
    this.name = 'EdgeFunctionError';
  }

  toApiResponse(): ApiResponse {
    return {
      ok: false,
      code: this.code,
      message: this.message
    };
  }

  // Legacy method for backward compatibility
  toStandardError(): { error: string; statusCode?: number; apiType: string } {
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

  // Check if file needs resumable upload
  if (file.size > RESUMABLE_UPLOAD_THRESHOLD) {
    console.log(`Large file detected (${Math.round(file.size / 1024 / 1024)}MB), using resumable upload`);
    return await uploadLargeFileResumable(file, apiKey, onProgress);
  }
  const apiUrl = `${SUPABASE_URL}/functions/v1/upload-audio`;
  
  onProgress?.({
    stage: 'uploading',
    percentage: 0,
    message: 'Uploading to Supabase Storage...',
    stageProgress: 0,
    totalBytes: file.size,
    currentStageIndex: 2
  });
  
  try {
    const response = await streamFileUpload(file, apiUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apiKey': apiKey
      },
      onProgress: (bytesUploaded, totalBytes) => {
        const percentage = Math.round((bytesUploaded / totalBytes) * 100);
        onProgress?.({
          stage: 'uploading',
          percentage: percentage,
          message: 'Uploading to storage...',
          stageProgress: percentage,
          bytesUploaded,
          totalBytes,
          currentStageIndex: 2
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
    onProgress?.({
      stage: 'uploading',
      percentage: 100,
      message: 'Upload complete!',
      stageProgress: 100,
      completedStages: ['validating', 'uploading'],
      currentStageIndex: 2
    });
    
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

/**
 * Upload large files using resumable upload service
 */
const uploadLargeFileResumable = async (
  file: File,
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<UploadResponse> => {
  try {
    const resumableService = new ResumableUploadService(apiKey);
    
    const result = await resumableService.uploadAudio(file, {
      apiKey,
      onProgress: (resumableProgress) => {
        // Map resumable progress to our progress callback format
        let stage: 'validating' | 'compressing' | 'uploading' | 'transcribing' | 'summarizing' | 'saving' | 'complete';
        let currentStageIndex: number;
        
        switch (resumableProgress.stage) {
          case 'preparing':
            stage = 'validating';
            currentStageIndex = 0;
            break;
          case 'compressing':
            stage = 'compressing';
            currentStageIndex = 1;
            break;
          case 'uploading-original':
          case 'uploading-compressed':
            stage = 'uploading';
            currentStageIndex = 2;
            break;
          case 'complete':
            stage = 'uploading';
            currentStageIndex = 2;
            break;
          default:
            stage = 'uploading';
            currentStageIndex = 2;
        }
        
        onProgress?.({
          stage,
          percentage: resumableProgress.percentage,
          message: resumableProgress.message,
          stageProgress: resumableProgress.percentage,
          bytesUploaded: resumableProgress.bytesUploaded,
          totalBytes: resumableProgress.totalBytes,
          currentStageIndex
        });
      },
      onError: (error) => {
        console.error('Resumable upload error:', error);
        throw new EdgeFunctionError(`Resumable upload failed: ${error.message}`);
      }
    });
    
    // Convert ResumableUploadResult to UploadResponse format
    const uploadResponse: UploadResponse = {
      uploadId: result.uploadId,
      storagePath: result.compressedPath || result.originalPath, // Prefer compressed for transcription
      fileSize: result.compressedSize || result.originalSize,
      fileName: file.name
    };
    
    return uploadResponse;
    
  } catch (error) {
    console.error('Resumable upload failed:', error);
    throw new EdgeFunctionError(`Resumable upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  
  onProgress?.({
    stage: 'transcribing',
    percentage: 0,
    message: 'Starting server-side transcription...',
    stageProgress: 0,
    isIndeterminate: true,
    currentStageIndex: 3
  });
  
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
        maxChunkSize: getOpenAIChunkLimit()
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new EdgeFunctionError(errorData.error || 'Transcription failed', response.status);
    }

    onProgress?.({
      stage: 'transcribing',
      percentage: 75,
      message: 'Processing transcription chunks...',
      stageProgress: 75,
      currentStageIndex: 3
    });
    
    const transcriptData = await response.json();
    
    onProgress?.({
      stage: 'transcribing',
      percentage: 100,
      message: 'Transcription complete!',
      stageProgress: 100,
      completedStages: ['validating', 'uploading', 'transcribing'],
      currentStageIndex: 3
    });
    return transcriptData as TranscriptData;
    
  } catch (error) {
    console.error('Error in transcribeFromStorage:', error);
    
    if (error instanceof EdgeFunctionError) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new EdgeFunctionError('Network error: Unable to connect to Supabase edge function. Please check your Supabase connection and try again.');
    }
    
    throw new EdgeFunctionError(`Failed to transcribe from storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const streamTranscribeFromStorage = async (
  uploadResponse: UploadResponse,
  apiKey: string,
  onProgress?: ProgressCallback,
  onSegment?: (segment: { text: string; timestamp: string }) => void
): Promise<TranscriptData> => {
  console.log('streamTranscribeFromStorage called for upload:', uploadResponse.uploadId);
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new EdgeFunctionError('Supabase connection not configured');
  }

  const apiUrl = `${SUPABASE_URL}/functions/v1/transcribe-stream`;
  
  onProgress?.({
    stage: 'transcribing',
    percentage: 0,
    message: 'Starting streaming transcription...',
    stageProgress: 0,
    isIndeterminate: true,
    currentStageIndex: 3
  });
  
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
        maxChunkSize: getOpenAIChunkLimit()
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new EdgeFunctionError(errorData.error || 'Streaming transcription failed', response.status);
    }

    if (!response.body) {
      throw new EdgeFunctionError('No response body for streaming transcription');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalTranscript: TranscriptData | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              console.log('Streaming transcription completed');
              break;
            }
            
            try {
              const eventData = JSON.parse(data);
              
              switch (eventData.type) {
                case 'progress':
                  onProgress?.({
                    stage: 'transcribing',
                    percentage: eventData.data.percentage,
                    message: eventData.data.message,
                    stageProgress: eventData.data.percentage,
                    chunksReceived: eventData.data.chunksReceived,
                    totalChunks: eventData.data.totalChunks,
                    currentStageIndex: 3
                  });
                  break;
                  
                case 'chunk_complete':
                  console.log(`Chunk ${eventData.data.chunkIndex + 1} completed`);
                  // If there are segments in this chunk, pass them to the callback
                  if (eventData.data.segments && onSegment) {
                    eventData.data.segments.forEach((segment: any) => {
                      onSegment({
                        text: segment.text,
                        timestamp: segment.timestamp || `${Math.floor(Date.now() / 1000)}`
                      });
                    });
                  }
                  break;
                  
                case 'complete':
                  finalTranscript = eventData.data.transcript;
                  onProgress?.({
                    stage: 'transcribing',
                    percentage: 100,
                    message: 'Streaming transcription complete!',
                    stageProgress: 100,
                    completedStages: ['validating', 'uploading', 'transcribing'],
                    currentStageIndex: 3
                  });
                  break;
                  
                case 'error':
                  throw new EdgeFunctionError(eventData.data.error || 'Streaming transcription error');
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE event:', line, parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!finalTranscript) {
      throw new EdgeFunctionError('Streaming transcription completed but no final transcript received');
    }

    console.log('Streaming transcription completed:', finalTranscript);
    return finalTranscript;
    
  } catch (error) {
    console.error('Error in streaming transcription:', error);
    
    if (error instanceof EdgeFunctionError) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new EdgeFunctionError('Network error: Unable to connect to Supabase edge function. Please check your Supabase connection and try again.');
    }
    
    throw new EdgeFunctionError(`Failed to stream transcription: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

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
  onProgress?.({
    stage: 'uploading',
    percentage: 0,
    message: 'Preparing streamed upload...',
    stageProgress: 0,
    totalBytes: file.size,
    currentStageIndex: 2
  });
  
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
          onProgress?.({
            stage: 'uploading',
            percentage: percentage,
            message: 'Streaming audio file...',
            stageProgress: percentage,
            bytesUploaded,
            totalBytes,
            currentStageIndex: 2
          });
        },
        maxFileSize: 500 * 1024 * 1024, // 500MB limit
        timeout: 600000 // 10 minutes
      });
      
      // Upload complete, now processing
      onProgress?.({
        stage: 'transcribing',
        percentage: 0,
        message: 'Upload complete, processing on server...',
        stageProgress: 0,
        isIndeterminate: true,
        completedStages: ['validating', 'uploading'],
        currentStageIndex: 3
      });
      
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
      
      onProgress?.({
        stage: 'transcribing',
        percentage: 50,
        message: 'Transcribing audio with OpenAI Whisper...',
        stageProgress: 50,
        currentStageIndex: 3
      });
      
      const transcriptData = await response.json();
      console.log('Transcription completed via edge function:', transcriptData);
      
      onProgress?.({
        stage: 'transcribing',
        percentage: 100,
        message: 'Transcription complete!',
        stageProgress: 100,
        completedStages: ['validating', 'uploading', 'transcribing'],
        currentStageIndex: 3
      });
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
      onProgress?.({
        stage: 'uploading',
        percentage: 0,
        message: `Retry attempt ${attempt}/4`,
        stageProgress: 0,
        isIndeterminate: true,
        retryAttempt: attempt,
        currentStageIndex: 2
      });
    },
    onCountdown: (remainingSeconds) => {
      onProgress?.({
        stage: 'uploading',
        percentage: 0,
        message: `Retrying in ${remainingSeconds} seconds...`,
        stageProgress: 0,
        isIndeterminate: true,
        retryCountdown: remainingSeconds,
        currentStageIndex: 2
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
    throw new EdgeFunctionError('Supabase URL not configured. Please click "Connect to Supabase" in the top right to set up your Supabase connection.', 'SUPABASE_NOT_CONFIGURED');
  }

  if (!SUPABASE_ANON_KEY) {
    throw new EdgeFunctionError('Supabase anonymous key not configured. Please set up your Supabase connection.', 'SUPABASE_NOT_CONFIGURED');
  }

  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new EdgeFunctionError('Invalid OpenAI API key for summary generation', 'INVALID_API_KEY');
  }

  if (!transcript || !transcript.speakers || transcript.speakers.length === 0) {
    throw new EdgeFunctionError('Invalid transcript data for summary generation', 'INVALID_INPUT');
  }

  onProgress?.({
    stage: 'summarizing',
    percentage: 0,
    message: 'Generating summary with GPT...',
    stageProgress: 0,
    currentStageIndex: 4
  });
  
  const apiUrl = `${SUPABASE_URL}/functions/v1/generate-summary`;
  
  console.log('Sending summary request to edge function:', apiUrl);

  try {
    onProgress?.({
      stage: 'summarizing',
      percentage: 25,
      message: 'Sending transcript to AI...',
      stageProgress: 25,
      currentStageIndex: 4
    });
    
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
    onProgress?.({
      stage: 'summarizing',
      percentage: 75,
      message: 'Processing AI response...',
      stageProgress: 75,
      currentStageIndex: 4
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Summary edge function error:', errorData);
      
      if (response.status === 401) {
        throw new EdgeFunctionError('Invalid OpenAI API key. Please check your API key in Settings.', 'INVALID_API_KEY', 401);
      }
      
      throw new EdgeFunctionError(
        errorData.message || errorData.error || 'Summary generation error occurred',
        errorData.code || 'SUMMARY_ERROR',
        response.status
      );
    }

    const summaryData = await response.json();
    console.log('Summary completed via edge function:', summaryData);
    
    onProgress?.({
      stage: 'summarizing',
      percentage: 100,
      message: 'Summary generation complete!',
      stageProgress: 100,
      completedStages: ['validating', 'uploading', 'transcribing', 'summarizing'],
      currentStageIndex: 4
    });
    return summaryData as SummaryData;
  } catch (error) {
    console.error('Error calling summary edge function:', error);
    
    if (error instanceof EdgeFunctionError) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new EdgeFunctionError('Network error: Unable to connect to Supabase edge function. Please check your Supabase connection and try again.', 'NETWORK_ERROR');
    }
    
    throw new EdgeFunctionError(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`, 'SUMMARY_ERROR');
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