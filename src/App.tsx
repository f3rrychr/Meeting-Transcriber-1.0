import React, { useState, useRef } from 'react';
import { Upload, FileAudio, Settings, Download, Copy, Play, Pause, RefreshCw, X } from 'lucide-react';
import MenuBar from './components/MenuBar';
import TranscriptPanel from './components/TranscriptPanel';
import SummaryPanel from './components/SummaryPanel';
import ProgressBar from './components/ProgressBar';
import SettingsModal from './components/SettingsModal';
import AboutModal from './components/AboutModal';
import ExportPreferencesModal from './components/ExportPreferencesModal';
import UserGuideModal from './components/UserGuideModal';
import TranscriptionHistoryModal from './components/TranscriptionHistoryModal';
import ActionTrackerModal from './components/ActionTrackerModal';
import AudioUpload from './components/AudioUpload';
import { TranscriptionStorage } from './utils/storageUtils';
import { ProcessingState, TranscriptData, SummaryData, ExportPreferences } from './types/index';
import { exportTranscriptAsDocx, exportSummaryAsDocx, exportTranscriptAsPdf, exportSummaryAsPdf } from './utils/exportUtils';
import { transcribeAudio, diarizeSpeakers, generateSummary, validateAPIKeys, APIError } from './services/apiService';
import { transcribeAudioViaEdgeFunction, generateSummaryViaEdgeFunction, EdgeFunctionError, checkSupabaseConnection, uploadAudioToStorage, streamTranscribeFromStorage } from './services/edgeFunctionService';
import { AudioProcessor } from './utils/audioUtils';

// Get limits from environment variables with fallbacks
const getFileSizeLimit = (): number => {
  const envLimit = import.meta.env.VITE_MAX_FILE_SIZE_MB;
  return envLimit ? parseInt(envLimit) * 1024 * 1024 : 500 * 1024 * 1024; // Default 500MB
};

const getDurationLimit = (): number => {
  const envLimit = import.meta.env.VITE_MAX_DURATION_MINUTES;
  return envLimit ? parseInt(envLimit) : 180; // Default 180 minutes (3 hours)
};

// Local storage keys
const STORAGE_KEYS = {
  API_KEYS: 'meeting-transcriber-api-keys'
};

// Load API keys from localStorage
const loadAPIKeys = (): { openai: string; huggingface: string } => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.API_KEYS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load API keys from localStorage:', error);
  }
  return { openai: '', huggingface: '' };
};

// Save API keys to localStorage
const saveAPIKeys = (keys: { openai: string; huggingface: string }) => {
  try {
    localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(keys));
  } catch (error) {
    console.warn('Failed to save API keys to localStorage:', error);
  }
};

function App() {
  // Initialize storage on app startup
  React.useEffect(() => {
    TranscriptionStorage.initialize();
  }, []);

  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showExportPrefs, setShowExportPrefs] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [showTranscriptionHistory, setShowTranscriptionHistory] = useState(false);
  const [showActionTracker, setShowActionTracker] = useState(false);
  const [apiKeys, setApiKeys] = useState(loadAPIKeys());
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<{ transcript?: TranscriptData; summary?: SummaryData } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingSegments, setStreamingSegments] = useState<Array<{ text: string; timestamp: string }>>([]);
  const [exportPreferences, setExportPreferences] = useState<ExportPreferences>({
    defaultFormat: 'txt',
    includeTimestamps: true,
    timestampInterval: 5,
    defaultLocation: 'source',
    customLocation: '',
    filenamePrefix: '',
    includeSpeakerLabels: true,
    includeMetadata: true
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Request notification permission on app load
  React.useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    // Prevent multiple simultaneous uploads
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);
    setCurrentFile(file);
    setProcessingState('processing');
    setProgress(0);
    setProcessingError(null);
    setTranscript(null);
    setSummary(null);
    setViewingRecord(null);
    setIsStreaming(false);
    setStreamingSegments([]);
    
    await processAudioFile(file);
    setIsProcessing(false);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
    // Reset the input value to allow selecting the same file again
    e.target.value = '';
  };

  const processAudioFile = async (file: File) => {
    let processingStep = 'initialization';
    console.log('processAudioFile started for:', file.name);
    try {
      // Step 1: Upload and validate (5%)
      processingStep = 'validation';
      console.log('Step 1: Validation');
      setProgress(5);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if compression is needed
      processingStep = 'compression check';
      const needsCompression = AudioProcessor.needsCompression(file);
      if (needsCompression) {
        setProgress(8);
        // Note: Compression is handled inside transcribeAudio function
      }

      // Step 2: Transcription with streaming
      processingStep = 'transcription';
      console.log('Step 2: Starting streaming transcription...');
      setProgress(10);
      
      let transcriptData: TranscriptData;
      
      // Determine which service to use based on API key and Supabase availability
      const hasValidApiKey = apiKeys.openai && apiKeys.openai.trim() !== '' && apiKeys.openai.startsWith('sk-');
      
      if (!hasValidApiKey) {
        throw new EdgeFunctionError('OpenAI API key is required. Please add your API key in Settings.');
      }

      // Check if Supabase is connected before attempting transcription
      const hasSupabaseConnection = checkSupabaseConnection();
      
      if (!hasSupabaseConnection) {
        setProcessingState('error');
        setProcessingError('Supabase connection is required. Please click "Connect to Supabase" in the top right corner to set up your Supabase project.');
        return;
      }

      console.log('Valid OpenAI API key found, attempting streaming transcription via edge function');
      try {
        setIsStreaming(true);
        
        // First upload the file to storage
        const uploadResponse = await uploadAudioToStorage(
          file,
          apiKeys.openai,
          (progress, message) => {
            setProgress(progress);
          }
        );
        
        // Then transcribe from storage with streaming
        transcriptData = await streamTranscribeFromStorage(
          uploadResponse,
          apiKeys.openai,
          (progress, message) => {
            setProgress(progress);
          }
        );
        
        setIsStreaming(false);
        console.log('Streaming transcription successful via edge function');
      } catch (error) {
        setIsStreaming(false);
        console.error('Edge function streaming transcription failed:', error);
        // Re-throw the error to show the user what went wrong
        throw error;
      }
      
      console.log('Transcription completed:', transcriptData);
      setProgress(70);
      setTranscript(transcriptData);

      // Step 3: Summary Generation (100%)
      processingStep = 'summary generation';
      console.log('Step 3: Starting summary generation...');
      setProgress(80);
      
      let summaryData: SummaryData;
      
      if (!hasValidApiKey) {
        throw new EdgeFunctionError('OpenAI API key is required for summary generation. Please add your API key in Settings.');
      }

      // Check if Supabase is connected before attempting summary generation
      if (!hasSupabaseConnection) {
        setProcessingState('error');
        setProcessingError('Supabase connection is required for summary generation. Please click "Connect to Supabase" in the top right corner.');
        return;
      }

      console.log('Valid OpenAI API key found, attempting summary generation via edge function');
      try {
        summaryData = await generateSummaryViaEdgeFunction(transcriptData, apiKeys.openai);
        console.log('Summary generation successful via edge function');
      } catch (error) {
        console.error('Edge function summary failed:', error);
        // Re-throw the error to show the user what went wrong
        throw error;
      }
      
      setSummary(summaryData);
      setProgress(100);
      
      setProcessingState('completed');
      
      // Save transcription to history
      TranscriptionStorage.saveTranscription(file.name, transcriptData, summaryData);
      
      // Show success notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Meeting Transcriber', {
          body: `Transcription completed for ${file.name}`,
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error('Processing failed at step:', processingStep, error);
      setProcessingState('error');
      setIsStreaming(false);
      
      if (error instanceof APIError || error instanceof EdgeFunctionError) {
        const apiResponse = error instanceof APIError ? error.toApiResponse() : error.toApiResponse();
        setProcessingError(`${apiResponse.code}: ${apiResponse.message}`);
        
        // If it's an API key error or missing connection, open settings
        if (apiResponse.code === 'INVALID_API_KEY' || apiResponse.code === 'SUPABASE_NOT_CONFIGURED') {
          setShowSettings(true);
        }
      } else {
        setProcessingError(`Processing failed at ${processingStep}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const handleSaveAPIKeys = (keys: { openai: string; huggingface: string }) => {
    setApiKeys(keys);
    saveAPIKeys(keys);
  };

  const resetApp = () => {
    console.log('resetApp called');
    setIsProcessing(false);
    setProcessingState('idle');
    setProgress(0);
    setCurrentFile(null);
    setTranscript(null);
    setSummary(null);
    setProcessingError(null);
    setIsStreaming(false);
    setStreamingSegments([]);
  };

  const handleExportTranscript = () => {
    if (!transcript || !currentFile) return;
    
    const fileName = currentFile.name.replace(/\.[^/.]+$/, "");
    
    if (exportPreferences.defaultFormat === 'docx') {
      exportTranscriptAsDocx(transcript, fileName, exportPreferences.includeTimestamps);
    } else if (exportPreferences.defaultFormat === 'pdf') {
      exportTranscriptAsPdf(transcript, fileName, exportPreferences.includeTimestamps);
    } else {
      // TXT format
      let content = `Meeting Transcript\n`;
      content += `==================\n\n`;
      content += `Meeting: ${transcript.meetingTitle}\n`;
      content += `Date: ${transcript.meetingDate}\n`;
      content += `Duration: ${transcript.duration}\n`;
      content += `Word Count: ${transcript.wordCount}\n\n`;
      content += `Transcript:\n`;
      content += `-----------\n\n`;
      
      transcript.speakers.forEach(speaker => {
        content += `${speaker.id}:\n`;
        speaker.segments.forEach(segment => {
          if (exportPreferences.includeTimestamps) {
            content += `[${segment.timestamp}] ${segment.text}\n`;
          } else {
            content += `${segment.text}\n`;
          }
        });
        content += `\n`;
      });
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}_transcript.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleExportSummary = () => {
    if (!summary || !currentFile) return;
    
    const fileName = currentFile.name.replace(/\.[^/.]+$/, "");
    
    if (exportPreferences.defaultFormat === 'docx') {
      exportSummaryAsDocx(summary, fileName);
    } else if (exportPreferences.defaultFormat === 'pdf') {
      exportSummaryAsPdf(summary, fileName);
    } else {
      // TXT format
      let content = `Meeting Summary\n`;
      content += `===============\n\n`;
      content += `Meeting: ${summary.meetingContext.meetingName}\n`;
      content += `Date: ${summary.meetingContext.meetingDate}\n`;
      content += `Participants: ${summary.meetingContext.participants.join(', ')}\n\n`;
      
      content += `Key Points:\n`;
      content += `-----------\n`;
      summary.keyPoints.forEach((point, index) => {
        content += `${index + 1}. ${point}\n`;
      });
      content += `\n`;
      
      content += `Action Items:\n`;
      content += `-------------\n`;
      summary.actionItems.forEach((item, index) => {
        content += `${index + 1}. ${item.task}\n`;
        content += `   PIC: ${item.assignee}\n`;
        content += `   Due: ${item.dueDate}\n`;
        if (item.remarks) {
          content += `   Remarks: ${item.remarks}\n`;
        }
        content += `\n`;
      });
      
      content += `Risks & Issues:\n`;
      content += `---------------\n`;
      summary.risks.forEach((risk, index) => {
        content += `${index + 1}. [${risk.type}] ${risk.category}: ${risk.item}\n`;
        if (risk.remarks) {
          content += `   Remarks: ${risk.remarks}\n`;
        }
        content += `\n`;
      });
      
      content += `Next Meeting:\n`;
      content += `-------------\n`;
      content += `Meeting: ${summary.nextMeetingPlan.meetingName}\n`;
      content += `Date & Time: ${summary.nextMeetingPlan.scheduledDate} at ${summary.nextMeetingPlan.scheduledTime}\n`;
      content += `Agenda: ${summary.nextMeetingPlan.agenda}\n\n`;
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}_summary.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleViewTranscription = (record: any) => {
    setShowTranscriptionHistory(false);
    setTranscript(record.transcript);
    setSummary(record.summary);
    setCurrentFile(new File([], record.fileName));
    setProcessingState('completed');
    setViewingRecord({ transcript: record.transcript, summary: record.summary });
  };

  const handleViewSummary = (record: any) => {
    setShowTranscriptionHistory(false);
    setTranscript(record.transcript);
    setSummary(record.summary);
    setCurrentFile(new File([], record.fileName));
    setProcessingState('completed');
    setViewingRecord({ transcript: record.transcript, summary: record.summary });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header with Logo */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4 flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center mr-3">
            <FileAudio className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Meeting Transcriber 1.1</h1>
        </div>
      </header>

      {/* Menu Bar */}
      <MenuBar 
        onOpenSettings={() => setShowSettings(true)}
        onShowAbout={() => setShowAbout(true)}
        onShowExportPrefs={() => setShowExportPrefs(true)}
        onShowUserGuide={() => setShowUserGuide(true)}
        onShowTranscriptionHistory={() => setShowTranscriptionHistory(true)}
        onShowActionTracker={() => setShowActionTracker(true)}
        onReset={resetApp}
        hasContent={!!(transcript || summary)}
        onOpenFile={triggerFileSelect}
        onExportTranscript={handleExportTranscript}
        onExportSummary={handleExportSummary}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {processingState === 'idle' && (
          <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <AudioUpload onFileUpload={handleFileUpload} />
          </div>
        )}

        {processingState === 'processing' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md w-full">
              <div className="text-center mb-8">
                <RefreshCw className="w-16 h-16 text-green-500 mx-auto mb-4 animate-spin" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Processing Audio</h2>
                <p className="text-gray-600">{currentFile?.name}</p>
                <p className="text-sm text-gray-500 mt-2">Please wait, this may take several minutes...</p>
              </div>
              <ProgressBar progress={progress} />
              <div className="mt-4 text-center text-sm text-gray-500">
                {progress < 10 && "Uploading and validating audio file..."}
                {progress >= 10 && progress < 40 && "Transcribing audio with OpenAI Whisper..."}
                {progress >= 40 && progress < 70 && "Performing speaker diarization with Hugging Face..."}
                {progress >= 70 && progress < 100 && "Generating summary with GPT-3.5..."}
                {progress === 100 && "Processing complete!"}
              </div>
              <div className="mt-6 text-center">
                <button
                  onClick={resetApp}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel Processing
                </button>
              </div>
            </div>
          </div>
        )}

        {processingState === 'error' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md w-full text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {processingError?.includes('NETWORK_ERROR') && (
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Processing Failed</h2>
              <div className="text-gray-600 mb-6">
                <p className="mb-3">Critical processing error:</p>
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-left">
                  {processingError}
                </div>
                {processingError?.includes('CORS') && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-left">
                    <p className="font-medium text-blue-800 mb-2">💡 Solution:</p>
                    <p className="text-blue-700">
                      You can continue testing the app functionality using mock data. 
                      Simply upload an audio file without entering API keys to see how the transcription and summary features work.
                    </p>
                  </div>
              {processingError?.includes('quota') || processingError?.includes('RATE_LIMIT') ? (
              </div>
              ) : processingError?.includes('INVALID_API_KEY') ? (
                <button
                  onClick={resetApp}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Try Again
                </button>
                {(processingError?.includes('OpenAI API quota exceeded') || processingError?.includes('429')) ? (
                  <a
                    href="https://platform.openai.com/usage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors inline-block text-center"
                  >
                    Check OpenAI Usage & Billing
                  </a>
                ) : (processingError?.includes('Invalid OpenAI API key') || processingError?.includes('401')) ? (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Check API Settings
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {processingState === 'completed' && (
          <div className="flex-1 flex">
            {/* Split View */}
            <div className="flex-1 flex">
              <TranscriptPanel 
                transcript={transcript} 
                isLoading={processingState === 'processing'}
                fileName={currentFile?.name || ''}
                isStreaming={isStreaming}
                streamingSegments={streamingSegments}
              />
              <SummaryPanel 
                summary={summary} 
                isLoading={processingState === 'processing'}
                fileName={currentFile?.name || ''}
              />
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          apiKeys={apiKeys}
          onSave={handleSaveAPIKeys}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* About Modal */}
      {showAbout && (
        <AboutModal onClose={() => setShowAbout(false)} />
      )}

      {/* Export Preferences Modal */}
      {showExportPrefs && (
        <ExportPreferencesModal
          preferences={exportPreferences}
          onSave={setExportPreferences}
          onClose={() => setShowExportPrefs(false)}
        />
      )}

      {/* User Guide Modal */}
      {showUserGuide && (
        <UserGuideModal
          onClose={() => setShowUserGuide(false)}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {/* Transcription History Modal */}
      {showTranscriptionHistory && (
        <TranscriptionHistoryModal
          onViewTranscription={handleViewTranscription}
          onViewSummary={handleViewSummary}
          onClose={() => setShowTranscriptionHistory(false)}
        />
      )}

      {/* Action Tracker Modal */}
      {showActionTracker && (
        <ActionTrackerModal
          onClose={() => setShowActionTracker(false)}
        />
      )}

      {/* Hidden file input for menu trigger */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".mp3,.wav,.aac,.m4a,.ogg,.webm"
        onChange={handleFileInputChange}
      />
    </div>
  );
}

export default App;