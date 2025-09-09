import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Calendar, Hash, Trash2, ChevronDown, AlertTriangle, HardDrive } from 'lucide-react';
import { TranscriptionRecord } from '../types';
import { TranscriptionStorage } from '../utils/storageUtils';
import { exportTranscriptAsDocx, exportTranscriptAsPdf, exportSummaryAsDocx, exportSummaryAsPdf } from '../utils/exportUtils';

interface TranscriptionHistoryModalProps {
  onClose: () => void;
  onViewTranscription: (record: TranscriptionRecord) => void;
  onViewSummary: (record: TranscriptionRecord) => void;
}

const TranscriptionHistoryModal: React.FC<TranscriptionHistoryModalProps> = ({ 
  onClose, 
  onViewTranscription, 
  onViewSummary 
}) => {
  const [transcriptionRecords, setTranscriptionRecords] = useState<TranscriptionRecord[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    // Load transcription records and storage stats
    const records = TranscriptionStorage.getTranscriptions();
    const stats = TranscriptionStorage.getStorageStats();
    setTranscriptionRecords(records);
    setStorageStats(stats);
  };

  const handleDeleteRecord = (recordId: string) => {
    const record = transcriptionRecords.find(r => r.id === recordId);
    const recordTitle = record?.title || 'this transcription';
    
    if (confirm(`Are you sure you want to permanently delete "${recordTitle}"?\n\nThis action cannot be undone and will remove both the transcript and summary from your history.`)) {
      TranscriptionStorage.deleteTranscription(recordId);
      // Reload records after deletion
      const updatedRecords = TranscriptionStorage.getTranscriptions();
      setTranscriptionRecords(updatedRecords);
      setStorageStats(TranscriptionStorage.getStorageStats());
    }
  };

  const handleClearAllHistory = () => {
    if (showClearConfirm) {
      TranscriptionStorage.clearAllTranscriptions();
      loadData();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      // Auto-hide confirmation after 5 seconds
      setTimeout(() => setShowClearConfirm(false), 5000);
    }
  };

  const handlePruneOldRecords = () => {
    const result = TranscriptionStorage.pruneOldRecords();
    if (result.removed > 0) {
      alert(`Pruned ${result.removed} old records, saved ${Math.round(result.sizeSaved / 1024)}KB of storage space.`);
      loadData();
    } else {
      alert('No records needed to be pruned. Storage is within limits.');
    }
  };

  const handleDownloadTranscript = (record: TranscriptionRecord, format: 'txt' | 'docx' | 'pdf') => {
    const baseFileName = record.fileName.replace(/\.[^/.]+$/, "");
    
    if (format === 'docx') {
      exportTranscriptAsDocx(record.transcript, baseFileName, true);
    } else if (format === 'pdf') {
      exportTranscriptAsPdf(record.transcript, baseFileName, true);
    } else {
      // TXT format
      let content = `Meeting Transcript\n`;
      content += `==================\n\n`;
      content += `Meeting: ${record.transcript.meetingTitle}\n`;
      content += `Date: ${record.transcript.meetingDate}\n`;
      content += `Duration: ${record.transcript.duration}\n`;
      content += `Word Count: ${record.transcript.wordCount}\n\n`;
      content += `Transcript:\n`;
      content += `-----------\n\n`;
      
      record.transcript.speakers.forEach(speaker => {
        content += `${speaker.id}:\n`;
        speaker.segments.forEach(segment => {
          content += `[${segment.timestamp}] ${segment.text}\n`;
        });
        content += `\n`;
      });
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseFileName}_transcript.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setActiveDropdown(null);
  };

  const handleDownloadSummary = (record: TranscriptionRecord, format: 'txt' | 'docx' | 'pdf') => {
    const baseFileName = record.fileName.replace(/\.[^/.]+$/, "");
    
    if (format === 'docx') {
      exportSummaryAsDocx(record.summary, baseFileName);
    } else if (format === 'pdf') {
      exportSummaryAsPdf(record.summary, baseFileName);
    } else {
      // TXT format
      let content = `Meeting Summary\n`;
      content += `===============\n\n`;
      content += `Meeting: ${record.summary.meetingContext.meetingName}\n`;
      content += `Date: ${record.summary.meetingContext.meetingDate}\n`;
      content += `Participants: ${record.summary.meetingContext.participants.join(', ')}\n\n`;
      
      content += `Key Points:\n`;
      content += `-----------\n`;
      record.summary.keyPoints.forEach((point, index) => {
        content += `${index + 1}. ${point}\n`;
      });
      content += `\n`;
      
      content += `Action Items:\n`;
      content += `-------------\n`;
      record.summary.actionItems.forEach((item, index) => {
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
      record.summary.risks.forEach((risk, index) => {
        content += `${index + 1}. [${risk.type}] ${risk.category}: ${risk.item}\n`;
        if (risk.remarks) {
          content += `   Remarks: ${risk.remarks}\n`;
        }
        content += `\n`;
      });
      
      content += `Next Meeting:\n`;
      content += `-------------\n`;
      content += `Meeting: ${record.summary.nextMeetingPlan.meetingName}\n`;
      content += `Date & Time: ${record.summary.nextMeetingPlan.scheduledDate} at ${record.summary.nextMeetingPlan.scheduledTime}\n`;
      content += `Agenda: ${record.summary.nextMeetingPlan.agenda}\n\n`;
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseFileName}_summary.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setActiveDropdown(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Previous Transcription History
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          {/* Storage Statistics */}
          {storageStats && (
            <div className={`mb-6 p-4 rounded-lg border ${
              storageStats.isNearLimit ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-medium flex items-center ${
                  storageStats.isNearLimit ? 'text-amber-800' : 'text-blue-800'
                }`}>
                  <HardDrive className="w-4 h-4 mr-2" />
                  Storage Usage
                  {storageStats.isNearLimit && <AlertTriangle className="w-4 h-4 ml-2 text-amber-600" />}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handlePruneOldRecords}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Optimize Storage
                  </button>
                  <button
                    onClick={handleClearAllHistory}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      showClearConfirm 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                  >
                    {showClearConfirm ? 'Confirm Clear All' : 'Clear All History'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className={storageStats.isNearLimit ? 'text-amber-700' : 'text-blue-700'}>
                    Records: {storageStats.recordCount}/{storageStats.maxRecords}
                  </span>
                </div>
                <div>
                  <span className={storageStats.isNearLimit ? 'text-amber-700' : 'text-blue-700'}>
                    Size: {storageStats.sizeMB.toFixed(1)}/{storageStats.maxSizeMB} MB
                  </span>
                </div>
                <div>
                  <span className={storageStats.isNearLimit ? 'text-amber-700' : 'text-blue-700'}>
                    Usage: {storageStats.percentUsed.toFixed(1)}%
                  </span>
                </div>
              </div>
              {storageStats.isNearLimit && (
                <div className="mt-3 text-xs text-amber-700">
                  ⚠️ Storage is near capacity (max {storageStats.maxRecords} records or {storageStats.maxSizeMB}MB). Oldest records will be automatically removed when limits are exceeded.
                </div>
              )}
            </div>
          )}

          {transcriptionRecords.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden min-h-[500px]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        <div className="flex items-center">
                          <Hash className="w-4 h-4 mr-1" />
                          No.
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Date
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          Title
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transcription
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Summary
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Delete
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transcriptionRecords.map((record, index) => (
                      <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                          {new Date(record.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                          {record.title}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="relative">
                            <button
                              onClick={() => setActiveDropdown(activeDropdown === `transcript-${record.id}` ? null : `transcript-${record.id}`)}
                              className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                              <ChevronDown className="w-3 h-3 ml-1" />
                            </button>
                            {activeDropdown === `transcript-${record.id}` && (
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                                <button 
                                  onClick={() => handleDownloadTranscript(record, 'txt')} 
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                                >
                                  TXT
                                </button>
                                <button 
                                  onClick={() => handleDownloadTranscript(record, 'docx')} 
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                                >
                                  DOCX
                                </button>
                                <button 
                                  onClick={() => handleDownloadTranscript(record, 'pdf')} 
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                                >
                                  PDF
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="relative">
                            <button
                              onClick={() => setActiveDropdown(activeDropdown === `summary-${record.id}` ? null : `summary-${record.id}`)}
                              className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                              <ChevronDown className="w-3 h-3 ml-1" />
                            </button>
                            {activeDropdown === `summary-${record.id}` && (
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                                <button 
                                  onClick={() => handleDownloadSummary(record, 'txt')} 
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                                >
                                  TXT
                                </button>
                                <button 
                                  onClick={() => handleDownloadSummary(record, 'docx')} 
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                                >
                                  DOCX
                                </button>
                                <button 
                                  onClick={() => handleDownloadSummary(record, 'pdf')} 
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                                >
                                  PDF
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleDeleteRecord(record.id)}
                            className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Transcription Records</h3>
              <p className="text-gray-500">
                Your transcription history will appear here after you process audio files.
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranscriptionHistoryModal;