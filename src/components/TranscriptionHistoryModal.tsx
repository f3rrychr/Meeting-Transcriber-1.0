import React, { useState, useEffect } from 'react';
import { X, FileText, Eye, BookOpen, Calendar, Hash, Trash2 } from 'lucide-react';
import { TranscriptionRecord } from '../types';
import { TranscriptionStorage } from '../utils/storageUtils';

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

  useEffect(() => {
    // Load transcription records from localStorage
    const records = TranscriptionStorage.getTranscriptions();
    setTranscriptionRecords(records);
  }, []);

  const handleDeleteRecord = (recordId: string) => {
    if (confirm('Are you sure you want to delete this transcription record?')) {
      TranscriptionStorage.deleteTranscription(recordId);
      // Reload records after deletion
      const updatedRecords = TranscriptionStorage.getTranscriptions();
      setTranscriptionRecords(updatedRecords);
    }
  };

  const handleViewTranscription = (record: TranscriptionRecord) => {
    onViewTranscription(record);
    onClose();
  };

  const handleViewSummary = (record: TranscriptionRecord) => {
    onViewSummary(record);
    onClose();
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
          {transcriptionRecords.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                          <button
                            onClick={() => handleViewTranscription(record)}
                            className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </button>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleViewSummary(record)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            <BookOpen className="w-3 h-3 mr-1" />
                            View
                          </button>
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