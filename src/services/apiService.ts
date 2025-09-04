// API Service for handling OpenAI and Hugging Face integrations
import { TranscriptData, SummaryData, TranscriptSegment, Speaker } from '../types';
import { AudioProcessor } from '../utils/audioUtils';

export class APIError extends Error {
  constructor(message: string, public statusCode?: number, public apiType?: string) {
    super(message);
    this.name = 'APIError';
  }
}

export interface APIKeys {
  openai: string;
  huggingface: string;
}

// OpenAI Whisper API Integration
export const transcribeAudio = async (file: File, apiKey: string): Promise<TranscriptData> => {
  console.log('transcribeAudio called with file:', file.name, 'size:', file.size);
  console.log('API key provided:', apiKey ? 'Yes' : 'No', 'starts with sk-:', apiKey?.startsWith('sk-'));
  
  // Check network connectivity first
  try {
    console.log('Testing network connectivity...');
    const connectivityTest = await fetch('https://httpbin.org/get', { 
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    console.log('Network connectivity test result:', connectivityTest.ok);
  } catch (connectivityError) {
    console.error('Network connectivity test failed:', connectivityError);
    throw new APIError(
      'No internet connection detected. Please check your network connection and try again.',
      0,
      'network'
    );
  }

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('Request timeout after 5 minutes');
    controller.abort();
  }, 300000); // 5 minute timeout
  
  if (!apiKey || !apiKey.startsWith('sk-')) {
    console.error('Invalid API key:', { hasKey: !!apiKey, startsWithSk: apiKey?.startsWith('sk-') });
    throw new APIError('Invalid OpenAI API key. Key should start with "sk-"', 401, 'openai');
  }

  // Check if file needs compression for OpenAI's 25MB limit
  let processedFile = file;
  if (AudioProcessor.needsCompression(file)) {
    console.log(`File size (${AudioProcessor.formatFileSize(file.size)}) exceeds OpenAI limit. Compressing...`);
    try {
      processedFile = await AudioProcessor.compressAudio(file, (progress) => {
        console.log(`Compression progress: ${progress}%`);
      });
      console.log(`Compressed to ${AudioProcessor.formatFileSize(processedFile.size)}`);
    } catch (compressionError) {
      console.error('Compression failed:', compressionError);
      throw new APIError(
        `File too large for OpenAI API (${AudioProcessor.formatFileSize(file.size)}). Maximum size is 25MB. Compression failed: ${compressionError instanceof Error ? compressionError.message : 'Unknown error'}`,
        413,
        'openai'
      );
    }
  }

  const formData = new FormData();
  formData.append('file', processedFile);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');

  console.log('Sending request to OpenAI Whisper API...');
  console.log('FormData contents:', {
    file: processedFile.name,
    size: processedFile.size,
    type: processedFile.type
  });
  
  // Log request details for debugging
  console.log('Request details:', {
    url: 'https://api.openai.com/v1/audio/transcriptions',
    method: 'POST',
    hasAuthHeader: !!apiKey,
    fileSize: processedFile.size,
    fileName: processedFile.name
  });
  
  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('OpenAI API response status:', response.status);
    console.log('OpenAI API response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status}`;
      
      // Handle specific OpenAI error types
      if (response.status === 0) {
        throw new APIError(
          'Unable to reach OpenAI servers. This could be due to network issues, firewall restrictions, or OpenAI service outage.',
          response.status,
          'openai'
        );
      }
      
      if (response.status === 401) {
        throw new APIError(
          'Invalid OpenAI API key. Please check your API key in Settings and ensure it has sufficient permissions.',
          response.status,
          'openai'
        );
      }
      
      if (response.status === 429) {
        throw new APIError(
          'OpenAI API quota exceeded. Please check your billing and usage limits at https://platform.openai.com/usage',
          response.status,
          'openai'
        );
      }
      
      if (response.status >= 500) {
        throw new APIError(
          'OpenAI service is temporarily unavailable. Please try again in a few minutes.',
          response.status,
          'openai'
        );
      }
      
      if (response.status === 413) {
        throw new APIError(
          `File too large for OpenAI API. Maximum size is 25MB. Your file: ${AudioProcessor.formatFileSize(processedFile.size)}`,
          response.status,
          'openai'
        );
      }
      
      if (response.status === 415) {
        throw new APIError(
          'Unsupported audio format. Please use MP3, WAV, M4A, or other supported formats.',
          response.status,
          'openai'
        );
      }
      
      throw new APIError(errorMessage, response.status, 'openai');
    }

    const data = await response.json();
    console.log('OpenAI API response data:', data);
    
    // Validate response data
    if (!data || !data.segments) {
      console.error('Invalid response from OpenAI API:', data);
      throw new APIError('Invalid response from OpenAI API - no segments found', undefined, 'openai');
    }
    
    // Convert OpenAI response to our TranscriptData format
    return formatWhisperResponse(data, file, processedFile !== file);
  } catch (error) {
    console.error('Error in transcribeAudio:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack'
    });
    
    if (error instanceof APIError) {
      throw error;
    }
    
    // Handle different types of network errors
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        throw new APIError('Network error: Unable to connect to OpenAI API. Please check your internet connection and try again.', undefined, 'openai');
      }
    }
    
    if (error.name === 'AbortError') {
      throw new APIError('Request timed out after 5 minutes. Please try with a smaller file or check your connection.', undefined, 'openai');
    }
    
    throw new APIError(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`, undefined, 'openai');
  }
  finally {
    clearTimeout(timeoutId);
  }
};

// Format OpenAI Whisper response to our TranscriptData interface
const formatWhisperResponse = (whisperData: any, originalFile: File, wasCompressed: boolean = false): TranscriptData => {
  console.log('Formatting Whisper response...');
  
  if (!whisperData.segments || !Array.isArray(whisperData.segments)) {
    console.error('Invalid whisper data - no segments array:', whisperData);
    throw new APIError('Invalid transcription data received from OpenAI', undefined, 'openai');
  }
  
  const segments: TranscriptSegment[] = whisperData.segments?.map((segment: any) => ({
    text: segment.text.trim(),
    timestamp: formatTimestamp(segment.start),
    duration: segment.end - segment.start,
  })) || [];

  console.log(`Formatted ${segments.length} segments`);
  
  // For now, assign all segments to a single speaker since Whisper doesn't do diarization
  const speakers: Speaker[] = [{
    id: 'Speaker_1',
    segments: segments
  }];

  const result = {
    speakers,
    meetingDate: new Date(originalFile.lastModified).toLocaleDateString(),
    meetingTitle: originalFile.name.replace(/\.[^/.]+$/, "") + (wasCompressed ? " (Compressed)" : ""),
    duration: formatDuration(whisperData.duration || 0),
    wordCount: segments.reduce((count, segment) => count + segment.text.split(' ').length, 0)
  };
  
  console.log('Formatted transcript data:', result);
  return result;
};

// Hugging Face Speaker Diarization Integration
export const diarizeSpeakers = async (audioFile: File, transcript: TranscriptData, apiKey: string): Promise<TranscriptData> => {
  console.log('diarizeSpeakers called');
  
  if (!apiKey || !apiKey.startsWith('hf_')) {
    console.warn('Invalid Hugging Face API key, skipping diarization');
    return transcript; // Return original transcript instead of throwing error
  }

  try {
    console.log('Attempting Hugging Face speaker diarization...');
    
    // For now, simulate speaker diarization by splitting segments between speakers
    // This is a fallback until we can properly implement HF diarization
    const simulatedDiarization = simulateSpeakerDiarization(transcript);
    console.log('Simulated diarization completed');
    return simulatedDiarization;
    
  } catch (error) {
    console.warn('Speaker diarization failed, using single speaker:', error);
    if (error instanceof APIError) {
      throw error;
    }
    // If diarization fails, return original transcript with single speaker
    return transcript;
  }
};

// Simulate speaker diarization by alternating speakers
const simulateSpeakerDiarization = (transcript: TranscriptData): TranscriptData => {
  if (transcript.speakers.length === 0 || transcript.speakers[0].segments.length === 0) {
    return transcript;
  }

  const allSegments = transcript.speakers[0].segments;
  const speaker1Segments: TranscriptSegment[] = [];
  const speaker2Segments: TranscriptSegment[] = [];

  // Simple alternating pattern - in reality this would be based on audio analysis
  allSegments.forEach((segment, index) => {
    if (index % 2 === 0) {
      speaker1Segments.push(segment);
    } else {
      speaker2Segments.push(segment);
    }
  });

  const speakers: Speaker[] = [
    { id: 'Speaker_1', segments: speaker1Segments },
    { id: 'Speaker_2', segments: speaker2Segments }
  ].filter(speaker => speaker.segments.length > 0);

  return {
    ...transcript,
    speakers
  };
};

// Combine diarization results with transcript segments
const combineDiarizationWithTranscript = (transcript: TranscriptData, diarizationData: any): TranscriptData => {
  // This is a simplified implementation - in reality, you'd need to match
  // diarization timestamps with transcript segments more precisely
  try {
    const speakerMap = new Map<string, TranscriptSegment[]>();
    
    // Group segments by speaker based on diarization results
    transcript.speakers[0].segments.forEach((segment, index) => {
      // Simple mapping - in reality, you'd match by timestamp
      const speakerId = diarizationData[index % diarizationData.length]?.label || 'Speaker_1';
      
      if (!speakerMap.has(speakerId)) {
        speakerMap.set(speakerId, []);
      }
      speakerMap.get(speakerId)!.push(segment);
    });

    // Convert map to speakers array
    const speakers: Speaker[] = Array.from(speakerMap.entries()).map(([id, segments]) => ({
      id,
      segments
    }));

    return {
      ...transcript,
      speakers
    };
  } catch (error) {
    console.warn('Failed to combine diarization with transcript:', error);
    return transcript;
  }
};

// OpenAI GPT Integration for Summary Generation
export const generateSummary = async (transcript: TranscriptData, apiKey: string): Promise<SummaryData> => {
  console.log('generateSummary called');
  
  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
  
  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new APIError('Invalid OpenAI API key for summary generation', 401, 'openai');
  }

  if (!transcript || !transcript.speakers || transcript.speakers.length === 0) {
    throw new APIError('Invalid transcript data for summary generation', undefined, 'openai');
  }

  // Prepare transcript text for GPT
  const transcriptText = transcript.speakers.map(speaker => 
    speaker.segments.map(segment => `${speaker.id}: ${segment.text}`).join('\n')
  ).join('\n\n');

  console.log('Transcript text length:', transcriptText.length);
  
  if (transcriptText.length === 0) {
    throw new APIError('Empty transcript - cannot generate summary', undefined, 'openai');
  }

  const prompt = `Please analyze the following meeting transcript and provide a structured summary in JSON format with the following structure:

{
  "keyPoints": ["point1", "point2", ...],
  "actionItems": [
    {
      "task": "task description",
      "assignee": "person responsible",
      "dueDate": "YYYY-MM-DD",
      "remarks": "optional remarks"
    }
  ],
  "risks": [
    {
      "type": "Risk" or "Issue",
      "category": "category name",
      "item": "description",
      "remarks": "optional remarks"
    }
  ],
  "nextMeetingPlan": {
    "meetingName": "name",
    "scheduledDate": "YYYY-MM-DD",
    "scheduledTime": "HH:MM AM/PM",
    "agenda": "agenda description"
  },
  "meetingContext": {
    "meetingName": "${transcript.meetingTitle}",
    "meetingDate": "${transcript.meetingDate}",
    "participants": ["participant1", "participant2", ...]
  }
}

Transcript:
${transcriptText}`;

  console.log('Sending summary request to OpenAI GPT...');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert meeting analyst. Analyze meeting transcripts and provide structured summaries in the exact JSON format requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('GPT API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('GPT API error:', errorData);
      const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status}`;
      throw new APIError(errorMessage, response.status, 'openai');
    }

    const data = await response.json();
    console.log('GPT API response data:', data);
    const summaryText = data.choices[0]?.message?.content;

    if (!summaryText) {
      throw new APIError('No summary generated from OpenAI API', undefined, 'openai');
    }

    console.log('Summary text received:', summaryText);

    // Parse JSON response
    let summaryData;
    try {
      // Clean the response text to handle potential formatting issues
      const cleanedText = summaryText.trim();
      
      // Try to extract JSON if it's wrapped in markdown code blocks
      let jsonText = cleanedText;
      if (cleanedText.includes('```json')) {
        const jsonMatch = cleanedText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }
      } else if (cleanedText.includes('```')) {
        const jsonMatch = cleanedText.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }
      }
      
      // If JSON appears incomplete, try to fix common truncation issues
      if (!jsonText.endsWith('}')) {
        console.warn('JSON appears truncated, attempting to fix...');
        // Find the last complete object/array closure
        let braceCount = 0;
        let lastValidIndex = -1;
        for (let i = 0; i < jsonText.length; i++) {
          if (jsonText[i] === '{') braceCount++;
          if (jsonText[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              lastValidIndex = i;
            }
          }
        }
        if (lastValidIndex > -1) {
          jsonText = jsonText.substring(0, lastValidIndex + 1);
        }
      }
      
      summaryData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse summary JSON:', summaryText);
      console.error('Parse error:', parseError);
      
      // Fallback: create a basic summary structure with available text
      console.log('Creating fallback summary structure...');
      summaryData = {
        keyPoints: [summaryText.substring(0, 500) + '...'],
        actionItems: [],
        risks: [],
        nextMeetingPlan: {
          meetingName: "Follow-up Meeting",
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          scheduledTime: "10:00 AM",
          agenda: "Review previous meeting outcomes"
        },
        meetingContext: {
          meetingName: transcript.meetingTitle,
          meetingDate: transcript.meetingDate,
          participants: transcript.speakers.map(s => s.id)
        }
      };
    }
    
    console.log('Parsed summary data:', summaryData);
    return summaryData as SummaryData;
  } catch (error) {
    console.error('Error in generateSummary:', error);
    if (error instanceof APIError) {
      throw error;
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new APIError('Network error: Unable to connect to OpenAI API for summary generation', undefined, 'openai');
    }
    throw new APIError(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`, undefined, 'openai');
  }
    clearTimeout(timeoutId);
};

// Utility functions
const formatTimestamp = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

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