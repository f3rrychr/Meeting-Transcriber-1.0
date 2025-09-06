// Processing states for the application
export type ProcessingState = 'idle' | 'processing' | 'completed' | 'error';

// Speaker segment interface
export interface SpeakerSegment {
  timestamp: string;
  text: string;
}

// Speaker interface
export interface Speaker {
  id: string;
  name?: string;
  segments: SpeakerSegment[];
}

// Main transcript data structure
export interface TranscriptData {
  meetingTitle: string;
  meetingDate: string;
  duration: string;
  wordCount: number;
  speakers: Speaker[];
}

// Action item interface
export interface ActionItem {
  task: string;
  assignee: string;
  dueDate: string;
  remarks?: string;
}

// Risk/Issue interface
export interface RiskItem {
  type: 'Risk' | 'Issue';
  category: string;
  item: string;
  remarks?: string;
}

// Meeting context interface
export interface MeetingContext {
  meetingName: string;
  meetingDate: string;
  participants: string[];
}

// Next meeting plan interface
export interface NextMeetingPlan {
  meetingName: string;
  scheduledDate: string;
  scheduledTime: string;
  agenda: string;
}

// Main summary data structure
export interface SummaryData {
  meetingContext: MeetingContext;
  keyPoints: string[];
  actionItems: ActionItem[];
  risks: RiskItem[];
  nextMeetingPlan: NextMeetingPlan;
}

// Export preferences interface
export interface ExportPreferences {
  defaultFormat: 'txt' | 'docx' | 'pdf';
  includeTimestamps: boolean;
  timestampInterval: number;
  defaultLocation: 'source' | 'downloads' | 'custom';
  customLocation: string;
  filenamePrefix: string;
  includeSpeakerLabels: boolean;
  includeMetadata: boolean;
}

// Standard error interface for API responses
export interface StandardError {
  error: string;
  statusCode?: number;
  apiType?: 'openai' | 'huggingface' | 'supabase';
}

// Progress state interface for detailed progress tracking
export interface ProgressState {
  phase: 'upload' | 'processing' | 'transcription' | 'summary' | 'complete';
  percentage: number;
  isIndeterminate: boolean;
  message: string;
  bytesUploaded?: number;
  totalBytes?: number;
  chunksReceived?: number;
  totalChunks?: number;
  retryAttempt?: number;
  retryCountdown?: number;
}