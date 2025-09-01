import React, { useState } from 'react';
import { Copy, Download, Clock, Users, FileText } from 'lucide-react';
import { TranscriptData } from '../types';
import { exportTranscriptAsDocx, exportTranscriptAsPdf } from '../utils/exportUtils';

interface TranscriptPanelProps {
  transcript: TranscriptData | null;
  isLoading: boolean;
  fileName: string;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ transcript, isLoading, fileName }) => {
  const [copiedSegment, setCopiedSegment] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id?: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSegment(id || 'full');
    setTimeout(() => setCopiedSegment(null), 2000);
  };

  const exportTranscript = (format: 'txt' | 'docx' | 'pdf') => {
    if (!transcript) return;
    
    const baseFileName = fileName.replace(/\.[^/.]+$/, "");
    
    if (format === 'docx') {
      exportTranscriptAsDocx(transcript, baseFileName, true);
    } else if (format === 'pdf') {
      exportTranscriptAsPdf(transcript, baseFileName, true);
    } else {
      // TXT format
      let content = `Meeting Transcript\n`;
      content += `Title: ${transcript.meetingTitle}\n`;
      content += `Date: ${transcript.meetingDate}\n`;
      content += `Duration: ${transcript.duration}\n`;
      content += `Word Count: ${transcript.wordCount}\n\n`;
      
      transcript.speakers.forEach(speaker => {
        content += `\n=== ${speaker.id} ===\n`;
        speaker.segments.forEach(segment => {
          content += `[${segment.timestamp}] ${segment.text}\n`;
        });
      });

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseFileName}_transcript.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const getFullTranscriptText = () => {
    if (!transcript) return '';
    
    let fullText = '';
    transcript.speakers.forEach(speaker => {
      speaker.segments.forEach(segment => {
        fullText += `${speaker.id} [${segment.timestamp}]: ${segment.text}\n`;
      });
    });
    return fullText;
  };

  if (isLoading) {
    return (
      <div className="flex-1 border-r border-gray-200 bg-white p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 border-r border-gray-200 bg-white flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-green-600" />
            Transcript
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => copyToClipboard(getFullTranscriptText())}
              className="flex items-center px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copiedSegment === 'full' ? 'Copied!' : 'Copy All'}
            </button>
            <div className="relative group">
              <button className="flex items-center px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
              <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button onClick={() => exportTranscript('txt')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">TXT</button>
                <button onClick={() => exportTranscript('docx')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">DOCX</button>
                <button onClick={() => exportTranscript('pdf')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">PDF</button>
              </div>
            </div>
          </div>
        </div>
        
        {transcript && (
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Duration: {transcript.duration}
            </div>
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Speakers: {transcript.speakers.length}
            </div>
            <div>Date: {transcript.meetingDate}</div>
            <div>Words: {transcript.wordCount.toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Transcript Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {transcript ? (
          <div className="space-y-6">
            {transcript.speakers.map((speaker, speakerIndex) => (
              <div key={speaker.id} className="space-y-4">
                <h3 className="font-semibold text-lg text-gray-800 flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    speakerIndex % 2 === 0 ? 'bg-blue-500' : 'bg-purple-500'
                  }`} />
                  {speaker.id}
                </h3>
                
                {speaker.segments.map((segment, segmentIndex) => (
                  <div key={segmentIndex} className="ml-6 group">
                    <div className="flex items-start space-x-3">
                      <span className="text-xs text-gray-500 font-mono mt-1 min-w-16">
                        {segment.timestamp}
                      </span>
                      <p className="text-gray-800 leading-relaxed flex-1">
                        {segment.text}
                      </p>
                      <button
                        onClick={() => copyToClipboard(segment.text, `${speaker.id}-${segmentIndex}`)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-all"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    {copiedSegment === `${speaker.id}-${segmentIndex}` && (
                      <div className="ml-19 text-xs text-green-600 mt-1">Copied to clipboard!</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>No transcript available</p>
              <p className="text-sm mt-2">Upload an audio file to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptPanel;