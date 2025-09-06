import React from 'react';
import { FileAudio, Clock, Users, Copy, Check } from 'lucide-react';
import { TranscriptData } from '../types';

interface TranscriptPanelProps {
  transcript: TranscriptData | null;
  isLoading: boolean;
  fileName: string;
  isStreaming?: boolean;
  streamingSegments?: Array<{ text: string; timestamp: string }>;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ 
  transcript, 
  isLoading, 
  fileName,
  isStreaming = false,
  streamingSegments = []
}) => {
  const [copiedSegment, setCopiedSegment] = React.useState<string | null>(null);

  const copyToClipboard = async (text: string, segmentId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSegment(segmentId);
      setTimeout(() => setCopiedSegment(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const copyFullTranscript = async () => {
    if (!transcript) return;
    
    let fullText = '';
    transcript.speakers.forEach(speaker => {
      speaker.segments.forEach(segment => {
        fullText += `[${segment.timestamp}] ${speaker.id}: ${segment.text}\n`;
      });
    });
    
    await copyToClipboard(fullText, 'full-transcript');
  };

  // Combine streaming segments with completed transcript
  const displaySegments = React.useMemo(() => {
    if (isStreaming && streamingSegments.length > 0) {
      return streamingSegments;
    }
    
    if (transcript) {
      const segments: Array<{ text: string; timestamp: string; speaker?: string }> = [];
      transcript.speakers.forEach(speaker => {
        speaker.segments.forEach(segment => {
          segments.push({
            text: segment.text,
            timestamp: segment.timestamp,
            speaker: speaker.id
          });
        });
      });
      return segments;
    }
    
    return [];
  }, [transcript, isStreaming, streamingSegments]);

  if (isLoading && !isStreaming) {
    return (
      <div className="flex-1 bg-white border-r border-gray-200 flex items-center justify-center">
        <div className="text-center">
          <FileAudio className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Processing transcript...</p>
        </div>
      </div>
    );
  }

  if (!transcript && !isStreaming) {
    return (
      <div className="flex-1 bg-white border-r border-gray-200 flex items-center justify-center">
        <div className="text-center">
          <FileAudio className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Transcript will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileAudio className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Transcript</h2>
              <p className="text-sm text-gray-600">{fileName}</p>
            </div>
          </div>
          
          {isStreaming && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-red-600 font-medium">• Live</span>
            </div>
          )}
          
          {transcript && (
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{transcript.duration}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>{transcript.speakers.length} speakers</span>
              </div>
              <button
                onClick={copyFullTranscript}
                className="flex items-center space-x-1 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                {copiedSegment === 'full-transcript' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>Copy All</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {displaySegments.map((segment, index) => (
          <div 
            key={`segment-${index}`}
            className={`group p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-all ${
              isStreaming && index === displaySegments.length - 1 ? 'animate-fade-in' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-xs font-medium text-gray-500">
                    {segment.timestamp}
                  </span>
                  {'speaker' in segment && segment.speaker && (
                    <span className="text-xs font-medium text-blue-600">
                      {segment.speaker}
                    </span>
                  )}
                </div>
                <p className="text-gray-900 leading-relaxed">
                  {segment.text}
                  {isStreaming && index === displaySegments.length - 1 && (
                    <span className="animate-pulse text-blue-500 ml-1">|</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(segment.text, `segment-${index}`)}
                className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-gray-600 transition-all"
              >
                {copiedSegment === `segment-${index}` ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        ))}
        
        {isStreaming && displaySegments.length === 0 && (
          <div className="text-center py-8">
            <div className="animate-pulse">
              <FileAudio className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-gray-600">Waiting for transcription to begin...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptPanel;