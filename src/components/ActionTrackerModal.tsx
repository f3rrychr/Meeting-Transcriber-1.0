import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, User, Hash } from 'lucide-react';
import { TranscriptionRecord, ActionItem } from '../types';
import { TranscriptionStorage } from '../utils/storageUtils';

interface ActionTrackerModalProps {
  onClose: () => void;
}

interface ActionItemWithSource extends ActionItem {
  sourceId: string;
  sourceMeeting: string;
  sourceDate: string;
}

interface MeetingRecord {
  sourceId: string;
  meetingTitle: string;
  meetingDate: string;
  actionItem?: ActionItemWithSource;
}
const ActionTrackerModal: React.FC<ActionTrackerModalProps> = ({ onClose }) => {
  const [meetingRecords, setMeetingRecords] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    const loadMeetingRecords = () => {
      try {
        console.log('=== Action Tracker Debug ===');
        
        // Load all transcription records
        const records = TranscriptionStorage.getTranscriptions();
        console.log('Raw records from storage:', records);
        console.log('Number of records found:', records.length);
        
        let debugText = `Found ${records.length} transcription records\n`;
        
        const allMeetingRecords: MeetingRecord[] = [];

        records.forEach((record, recordIndex) => {
          console.log(`Processing record ${recordIndex + 1}:`, {
            id: record.id,
            title: record.title,
            date: record.date,
            hasSummary: !!record.summary,
            hasActionItems: !!(record.summary?.actionItems),
            actionItemsCount: record.summary?.actionItems?.length || 0
          });
          
          debugText += `\nRecord ${recordIndex + 1}: ${record.title}\n`;
          debugText += `  Date: ${record.date}\n`;
          debugText += `  Has Summary: ${!!record.summary}\n`;
          
          if (record.summary && record.summary.actionItems && Array.isArray(record.summary.actionItems)) {
            debugText += `  Action Items: ${record.summary.actionItems.length}\n`;
            
            record.summary.actionItems.forEach((item, itemIndex) => {
              console.log(`  Action item ${itemIndex + 1}:`, item);
              
              const actionItemWithSource: ActionItemWithSource = {
                task: item.task || 'No task description',
                assignee: item.assignee || 'Unassigned',
                dueDate: item.dueDate || 'No due date',
                remarks: item.remarks || '',
                sourceId: record.id,
                sourceMeeting: record.title || 'Untitled Meeting',
                sourceDate: record.date || 'Unknown Date'
              };
              
              const meetingRecord: MeetingRecord = {
                sourceId: record.id,
                meetingTitle: record.title || 'Untitled Meeting',
                meetingDate: record.date || 'Unknown Date',
                actionItem: actionItemWithSource
              };
              
              allMeetingRecords.push(meetingRecord);
              debugText += `    ${itemIndex + 1}. ${item.task} (${item.assignee})\n`;
            });
          } else {
            // Add meeting record even without action items
            debugText += `  Action Items: 0 (no action items, but adding meeting record)\n`;
            const meetingRecord: MeetingRecord = {
              sourceId: record.id,
              meetingTitle: record.title || 'Untitled Meeting',
              meetingDate: record.date || 'Unknown Date'
            };
            allMeetingRecords.push(meetingRecord);
          } else {
            debugText += `  Action Items: 0 (no summary or action items)\n`;
          }
        });

        console.log('Total meeting records extracted:', allMeetingRecords.length);
        console.log('All meeting records:', allMeetingRecords);
        
        debugText += `\nTotal meeting records found: ${allMeetingRecords.length}`;
        setDebugInfo(debugText);

        // Sort by meeting date (most recent first)
        allMeetingRecords.sort((a, b) => {
          const dateA = new Date(a.meetingDate);
          const dateB = new Date(b.meetingDate);
          return dateB.getTime() - dateA.getTime();
        });
        
        setMeetingRecords(allMeetingRecords);
      } catch (error) {
        console.error('Error loading action items:', error);
        setDebugInfo(`Error loading data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadMeetingRecords();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading action items...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <CheckSquare className="w-5 h-5 mr-2" />
            Action Tracker
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          {/* Debug Information */}
          <details className="mb-4 p-3 bg-gray-50 rounded-lg">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">Debug Information</summary>
            <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">{debugInfo}</pre>
          </details>

          {meetingRecords.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        <div className="flex items-center">
                          <Hash className="w-4 h-4 mr-1" />
                          No
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          Meeting Title
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action Item
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          PIC
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Due Date
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Remarks
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Remarks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {meetingRecords.map((record, index) => (
                      <tr key={`${record.sourceId}-${index}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          <div className="font-medium">{record.meetingTitle}</div>
                          <div className="text-xs text-gray-500 mt-1">{record.meetingDate}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {record.actionItem ? (
                            <div className="max-w-md">{record.actionItem.task}</div>
                          ) : (
                            <span className="text-gray-400 italic">No action items</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                          {record.actionItem ? record.actionItem.assignee : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                          {record.actionItem ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {record.actionItem.dueDate}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {record.actionItem?.remarks || '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {item.remarks || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Meeting Records Found</h3>
              <p className="text-gray-500">
                Meeting records from your transcription sessions will appear here.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Process some meeting audio files to see meeting records here.
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {meetingRecords.length > 0 ? `Showing ${meetingRecords.length} records from previous meetings` : 'No meeting records to display'}
          </div>
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

// Add missing import
import { FileText } from 'lucide-react';

export default ActionTrackerModal;