export type ProcessingState = 'idle' | 'processing' | 'completed' | 'error';

export interface TranscriptSegment {
  text: string;
  timestamp: string;
  duration: number;
}

export interface Speaker {
  id: string;
  segments: TranscriptSegment[];
}

export interface TranscriptData {
  speakers: Speaker[];
  meetingDate: string;
  meetingTitle: string;
  duration: string;
  wordCount: number;
}

export interface ActionItem {
  task: string;
  assignee: string;
  dueDate: string;
  remarks?: string;
}

export interface Risk {
  type: 'Risk' | 'Issue';
  category: string;
  item: string;
  remarks?: string;
}

export interface SummaryData {
  keyPoints: string[];
  actionItems: ActionItem[];
  nextMeetingPlan: {
    meetingName: string;
    scheduledDate: string;
    scheduledTime: string;
    agenda: string;
  };
  risks: Risk[];
  meetingContext: {
    meetingName: string;
    meetingDate: string;
    participants: string[];
  };
}

export interface ApiKeys {
  openai: string;
  huggingface: string;
}

export interface ExportPreferences {
  defaultFormat: 'txt' | 'docx' | 'pdf';
  includeTimestamps: boolean;
  timestampInterval: number;
  defaultLocation: 'source' | 'desktop' | 'documents';
  customLocation: string;
  filenamePrefix: string;
  includeSpeakerLabels: boolean;
  includeMetadata: boolean;
}

export interface ProgressState {
  phase: 'upload' | 'processing' | 'transcription' | 'summary' | 'complete';
  percentage: number;
  isIndeterminate: boolean;
  message: string;
  bytesUploaded?: number;
  totalBytes?: number;
  chunksReceived?: number;
  totalChunks?: number;
}

export interface TranscriptionRecord {
  id: string;
  date: string;
  title: string;
  transcript: TranscriptData;
  summary: SummaryData;
  fileName: string;
  createdAt: number;
}

export interface StandardError {
  error: string;
  statusCode?: number;
  apiType?: 'openai' | 'huggingface' | 'supabase';
  details?: string;
}