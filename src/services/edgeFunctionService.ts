// Edge Function Service for real API calls through Supabase
import { TranscriptData, SummaryData } from '../types';
import { AudioProcessor } from '../utils/audioUtils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class EdgeFunctionError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'EdgeFunctionError';
  }
}

export const transcribeAudioViaEdgeFunction = async (file: File, apiKey: string): Promise<TranscriptData> => {
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
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('apiKey', apiKey);

  const apiUrl = `${SUPABASE_URL}/functions/v1/transcribe-audio`;
  
  console.log('Sending request to edge function:', apiUrl);
  console.log('Request details:', {
    method: 'POST',
    hasFile: !!file,
    fileName: file.name,
    fileSize: file.size,
    hasApiKey: !!apiKey
  });

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
      const errorData = await response.json().catch(() => ({}));
      console.error('Edge function error response:', errorData);
      
      if (response.status === 401) {
        throw new EdgeFunctionError('Invalid OpenAI API key. Please check your API key in Settings.');
      }
      
      if (response.status === 413) {
        throw new EdgeFunctionError('File too large. Please try with a smaller audio file.');
      }
      
      throw new EdgeFunctionError(
        errorData.error || `Edge function error: ${response.status}`,
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

export const generateSummaryViaEdgeFunction = async (transcript: TranscriptData, apiKey: string): Promise<SummaryData> => {
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

  const apiUrl = `${SUPABASE_URL}/functions/v1/generate-summary`;
  
  console.log('Sending summary request to edge function:', apiUrl);

  try {
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Summary edge function error:', errorData);
      
      if (response.status === 401) {
        throw new EdgeFunctionError('Invalid OpenAI API key. Please check your API key in Settings.');
      }
      
      throw new EdgeFunctionError(
        errorData.error || `Summary generation error: ${response.status}`,
        response.status
      );
    }

    const summaryData = await response.json();
    console.log('Summary completed via edge function:', summaryData);
    
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
  const hasConnection = !!(SUPABASE_URL && SUPABASE_ANON_KEY && 
    SUPABASE_URL !== 'your_supabase_project_url' && 
    SUPABASE_ANON_KEY !== 'your_supabase_anon_key'
  );
  // Check if environment variables exist and aren't placeholder values
  const hasUrl = SUPABASE_URL && SUPABASE_URL !== 'your_supabase_project_url';
  const hasKey = SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== 'your_supabase_anon_key';
  
  return !!(hasUrl && hasKey);
  return hasConnection;
};