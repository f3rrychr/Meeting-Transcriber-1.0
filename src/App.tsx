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
import { ProcessingState, TranscriptData, SummaryData, ExportPreferences } from './types';
import { exportTranscriptAsDocx, exportSummaryAsDocx, exportTranscriptAsPdf, exportSummaryAsPdf } from './utils/exportUtils';
import { transcribeAudio, diarizeSpeakers, generateSummary, validateAPIKeys, APIError } from './services/apiService';
import { AudioProcessor } from './utils/audioUtils';

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

  const handleFileUpload = async (file: File) => {
    console.log('handleFileUpload called with file:', file.name);
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });
    console.log('Current API keys:', {
      hasOpenAI: !!apiKeys.openai,
      hasHuggingFace: !!apiKeys.huggingface,
      openAIValid: apiKeys.openai?.startsWith('sk-'),
      hfValid: apiKeys.huggingface?.startsWith('hf_')
    });
    
    // Prevent multiple simultaneous uploads
    if (isProcessing) {
      console.log('Already processing, ignoring new upload');
      return;
    }

    // Validate API keys before processing
    const validation = validateAPIKeys(apiKeys);
    console.log('API key validation result:', validation);
    
    if (!validation.isValid) {
      console.error('API validation failed:', validation.errors);
      setProcessingError(`API Keys Required: ${validation.errors.join(', ')}`);
      setShowSettings(true);
      return;
    }

    console.log('Starting file processing with valid API keys...');
    
    if (!validation.isValid) {
      setProcessingError(`API Keys Required: ${validation.errors.join(', ')}`);
      setShowSettings(true);
      return;
    }

    setIsProcessing(true);
    setCurrentFile(file);
    setProcessingState('processing');
    setProgress(0);
    setProcessingError(null);
    setTranscript(null);
    setSummary(null);
    
    console.log('Starting audio file processing...');
    try {
      await processAudioFile(file);
    } catch (error) {
      console.error('Critical error in handleFileUpload:', error);
      setProcessingState('error');
      setProcessingError(`Critical processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
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

      // Step 2: Transcription with OpenAI Whisper (40%)
      processingStep = 'transcription';
      console.log('Step 2: Starting transcription...');
      setProgress(10);
      console.log('Starting transcription with OpenAI Whisper...');
      let transcriptData;
      try {
        console.log('Calling transcribeAudio with:', {
          fileName: file.name,
          fileSize: file.size,
          apiKeyLength: apiKeys.openai?.length
        });
        transcriptData = await transcribeAudio(file, apiKeys.openai);
        console.log('Transcription successful, received data:', transcriptData);
      } catch (transcriptionError) {
        console.error('Transcription failed:', transcriptionError);
        console.error('Transcription error details:', {
          name: transcriptionError instanceof Error ? transcriptionError.name : 'Unknown',
          message: transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error',
          stack: transcriptionError instanceof Error ? transcriptionError.stack : 'No stack'
        });
        throw new Error(`Transcription failed at step ${processingStep}: ${transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error'}`);
      }
      console.log('Transcription completed:', transcriptData);
      setProgress(40);

      // Step 3: Speaker Diarization with Hugging Face (70%)
      processingStep = 'speaker diarization';
      console.log('Step 3: Starting speaker diarization...');
      setProgress(50);
      console.log('Starting speaker diarization...');
      let diarizedTranscript;
      try {
        diarizedTranscript = await diarizeSpeakers(file, transcriptData, apiKeys.huggingface);
        console.log('Diarization successful:', diarizedTranscript);
      } catch (diarizationError) {
        console.warn('Diarization failed, using original transcript:', diarizationError);
        diarizedTranscript = transcriptData; // Fallback to original transcript
      }
      console.log('Diarization completed:', diarizedTranscript);
      setTranscript(diarizedTranscript);
      setProgress(70);

      // Step 4: Summary Generation with OpenAI GPT (100%)
      processingStep = 'summary generation';
      console.log('Step 4: Starting summary generation...');
      setProgress(80);
      console.log('Starting summary generation...');
      let summaryData;
      try {
        summaryData = await generateSummary(diarizedTranscript, apiKeys.openai);
        console.log('Summary generation successful:', summaryData);
      } catch (summaryError) {
        console.error('Summary generation failed:', summaryError);
        console.error('Summary error details:', {
          name: summaryError instanceof Error ? summaryError.name : 'Unknown',
          message: summaryError instanceof Error ? summaryError.message : 'Unknown error'
        });
        throw new Error(`Summary generation failed at step ${processingStep}: ${summaryError instanceof Error ? summaryError.message : 'Unknown error'}`);
      }
      console.log('Summary completed:', summaryData);
      setSummary(summaryData);
      setProgress(100);
      
      console.log('All processing steps completed successfully');
      setProcessingState('completed');
      
      // Save transcription to history
      console.log('Saving transcription to history...');
      TranscriptionStorage.saveTranscription(file.name, diarizedTranscript, summaryData);
      console.log('Transcription saved to history');
      
      // Show success notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Meeting Transcriber', {
          body: `Transcription completed for ${file.name}`,
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error('Processing error:', error);
      console.error('Processing failed at step:', processingStep);
      console.error('Full error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      
      // Ensure we don't reset state unexpectedly
      setProcessingState('error');
      
      if (error instanceof APIError) {
        setProcessingError(`${error.apiType?.toUpperCase()} API Error at ${processingStep}: ${error.message}`);
        
        // If it's an API key error, open settings
        if (error.statusCode === 401) {
          setShowSettings(true);
        }
      } else {
        setProcessingError(`Processing failed at ${processingStep}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Re-throw to be caught by handleFileUpload
      throw error;
    }
  };

  // Keep the old mock functions as fallback (can be removed later)
  const simulateTranscription = async (file: File): Promise<TranscriptData> => {
    // Mock transcription data with speaker diarization
    return {
      speakers: [
        { id: 'Speaker_1', segments: [
          { text: "Good morning everyone, thank you for joining today's client meeting.", timestamp: '00:00:15', duration: 3.2 },
          { text: "Let's start by reviewing the project requirements we discussed last week.", timestamp: '00:01:30', duration: 4.1 }
        ]},
        { id: 'Speaker_2', segments: [
          { text: "Thanks for having us. We're excited to move forward with this initiative.", timestamp: '00:00:45', duration: 3.8 },
          { text: "Before we dive in, I'd like to clarify a few points about the timeline.", timestamp: '00:02:15', duration: 4.5 }
        ]}
      ],
      meetingDate: new Date(file.lastModified).toLocaleDateString(),
      meetingTitle: file.name.replace(/\.[^/.]+$/, ""),
      duration: '00:45:30',
      wordCount: 2847
    };
  };

  const simulateSummarization = async (): Promise<SummaryData> => {
    return {
      keyPoints: [
        "Project timeline confirmed for Q2 2024 delivery",
        "Budget approved at $125,000 with 10% contingency",
        "Team structure finalized with 5 developers and 2 designers",
        "Weekly check-ins scheduled for Thursdays at 2 PM"
      ],
      actionItems: [
        { task: "Finalize technical specifications document", assignee: "Development Team", dueDate: "2024-02-15", remarks: "Include API documentation" },
        { task: "Set up project management tools and access", assignee: "Project Manager", dueDate: "2024-02-10", remarks: "Jira and Confluence setup" },
        { task: "Schedule kickoff meeting with full team", assignee: "Client Success", dueDate: "2024-02-12", remarks: "Send calendar invites" }
      ],
      nextMeetingPlan: {
        meetingName: "Technical Architecture Review",
        scheduledDate: "2024-02-20",
        scheduledTime: "2:00 PM EST",
        agenda: "Review technical specifications and finalize development approach"
      },
      risks: [
        { type: "Risk", category: "Resource", item: "Potential resource conflicts with ongoing projects", remarks: "Monitor team availability closely" },
        { type: "Issue", category: "Technical", item: "Third-party API integration dependencies", remarks: "Identify backup solutions" },
        { type: "Risk", category: "Timeline", item: "Aggressive delivery schedule may impact quality", remarks: "Consider phased delivery approach" }
      ],
      meetingContext: {
        meetingName: "Q2 2024 Project Kickoff Meeting",
        meetingDate: "February 8, 2024",
        participants: [
          "Sarah Johnson (Project Manager)",
          "Mike Chen (Lead Developer)",
          "Emily Rodriguez (UX Designer)",
          "David Kim (Client Representative)",
          "Lisa Thompson (Business Analyst)"
        ]
      }
    };
  };

  // Legacy processing function (keeping for reference)
  const processAudioFileMock = async (file: File) => {
    try {
      // Step 1: Upload and validate (10%)
      setProgress(10);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Transcription (60%)
      setProgress(30);
      const mockTranscript = await simulateTranscription(file);
      setTranscript(mockTranscript);
      setProgress(60);

      // Step 3: Speaker Diarization (80%)
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgress(80);

      // Step 4: Summarization (100%)
      const mockSummary = await simulateSummarization();
      setSummary(mockSummary);
      setProgress(100);
      
      setProcessingState('completed');
      
      // Simulate Windows toast notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Meeting Transcriber', {
          body: `Transcription completed for ${file.name}`,
          icon: '/favicon.ico'
        });
      } else if ('Notification' in window && Notification.permission === 'default') {
        // Request notification permission for future use
        Notification.requestPermission();
      }
    } catch (error) {
      console.error('Processing error:', error);
      setProcessingState('error');
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
    setTranscript(record.transcript);
    setSummary(record.summary);
    setCurrentFile(new File([], record.fileName));
    setProcessingState('completed');
    setViewingRecord({ transcript: record.transcript, summary: record.summary });
  };

  const handleViewSummary = (record: any) => {
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
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Processing Failed</h2>
              <p className="text-gray-600 mb-6">{processingError || 'An error occurred while processing the audio file.'}</p>
              <div className="space-y-3">
                <button
                  onClick={resetApp}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Try Again
                </button>
                {/* Network-specific help */}
                {processingError?.includes('Network error') || processingError?.includes('network') || processingError?.includes('connectivity') ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => window.open('https://status.openai.com/', '_blank')}
                      className="w-full px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Check OpenAI Service Status
                    </button>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>• Check your internet connection</p>
                      <p>• Try disabling VPN if using one</p>
                      <p>• Check if your firewall blocks OpenAI</p>
                    </div>
                  </div>
                ) : processingError?.includes('quota') || processingError?.includes('billing') ? (
                {processingError?.includes('Network error') || processingError?.includes('network') || processingError?.includes('connectivity') ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => window.open('https://status.openai.com/', '_blank')}
                      className="w-full px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Check OpenAI Service Status
                    </button>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>• Check your internet connection</p>
                      <p>• Try disabling VPN if using one</p>
                      <p>• Check if your firewall blocks OpenAI</p>
                    </div>
                  </div>
                ) : processingError?.includes('quota') || processingError?.includes('billing') ? (
                {processingError?.includes('Network error') || processingError?.includes('network') || processingError?.includes('connectivity') ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => window.open('https://status.openai.com/', '_blank')}
                      className="w-full px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Check OpenAI Service Status
                    </button>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>• Check your internet connection</p>
                      <p>• Try disabling VPN if using one</p>
                      <p>• Check if your firewall blocks OpenAI</p>
                    </div>
                  </div>
                ) : processingError?.includes('quota') || processingError?.includes('billing') ? (
                  <a
                    href="https://platform.openai.com/usage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors inline-block text-center"
                  >
                    Check OpenAI Usage & Billing
                  </a>
                ) : processingError?.includes('Invalid OpenAI API key') || processingError?.includes('401') ? (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    Update API Key
                  </button>
                ) : processingError?.includes('Invalid OpenAI API key') || processingError?.includes('401') ? (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    Update API Key
                  </button>
                ) : processingError?.includes('Invalid OpenAI API key') || processingError?.includes('401') ? (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    Update API Key
                  </button>
                ) : (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Check API Settings
                  </button>
                )}
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
        accept=".mp3,.wav,.aac,.m4a,.ogg"
        onChange={handleFileInputChange}
      />
    </div>
  );
}

export default App;