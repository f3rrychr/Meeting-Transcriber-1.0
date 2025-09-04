import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, User, Hash, FileText } from 'lucide-react';
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

interface GroupedActionItems {
  date: string;
  items: ActionItemWithSource[];
}

const ActionTrackerModal: React.FC<ActionTrackerModalProps> = ({ onClose }) => {
  const [groupedActionItems, setGroupedActionItems] = useState<GroupedActionItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActionItems = () => {
      try {
        // Load all transcription records
        const records = TranscriptionStorage.getTranscriptions();
        console.log('Loading action items from', records.length, 'records');
        
        const allActionItems: ActionItemWithSource[] = [];

        records.forEach((record, recordIndex) => {
          if (record.summary && record.summary.actionItems && Array.isArray(record.summary.actionItems)) {
            record.summary.actionItems.forEach((item, itemIndex) => {
              const actionItemWithSource: ActionItemWithSource = {
                task: item.task || 'No task description',
                assignee: item.assignee || 'Unassigned',
                dueDate: item.dueDate || 'No due date',
                remarks: item.remarks || '',
                sourceId: record.id,
                sourceMeeting: record.title || 'Untitled Meeting',
                sourceDate: record.date || 'Unknown Date'
              };
              
              allActionItems.push(actionItemWithSource);
            });
          }
        });

        // Group action items by date
        const groupedByDate = allActionItems.reduce((groups, item) => {
          const date = item.sourceDate;
          if (!groups[date]) {
            groups[date] = [];
          }
          groups[date].push(item);
          return groups;
        }, {} as Record<string, ActionItemWithSource[]>);

        // Convert to array and sort by date (most recent first)
        const groupedArray: GroupedActionItems[] = Object.entries(groupedByDate)
          .map(([date, items]) => ({ date, items }))
          .sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        });
        
        console.log('Grouped action items:', groupedArray);
        setGroupedActionItems(groupedArray);
      } catch (error) {
        console.error('Error loading action items:', error);
      } finally {
        setLoading(false);
      }
    };

    loadActionItems();
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
          {groupedActionItems.length > 0 ? (
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
                          <Calendar className="w-4 h-4 mr-1" />
                          Meeting Date
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          Meeting & Action Item
                        </div>
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
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groupedActionItems.map((group, groupIndex) => {
                      let itemCounter = 1;
                      if (groupIndex > 0) {
                        itemCounter = groupedActionItems.slice(0, groupIndex).reduce((sum, g) => sum + g.items.length, 1);
                      }
                      
                      return group.items.map((item, itemIndex) => {
                        const currentItemNumber = itemCounter + itemIndex;
                        const isFirstItemOfDate = itemIndex === 0;
                        
                        return (
                          <tr key={`${item.sourceId}-${itemIndex}`} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {currentItemNumber}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                              {isFirstItemOfDate && (
                                <div className="font-medium text-blue-700 mb-1">
                                  {new Date(group.date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </div>
                              )}
                              {!isFirstItemOfDate && <div className="h-5"></div>}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">
                              <div className="font-medium text-gray-800 mb-1">{item.sourceMeeting}</div>
                              <div className="text-gray-700">{item.task}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {item.assignee}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {item.dueDate}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700">
                              {item.remarks || '-'}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Action Items Found</h3>
              <p className="text-gray-500">
                Action items from your transcription sessions will appear here.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Process some meeting audio files to see action items here.
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {groupedActionItems.length > 0 ? 
              `Showing ${groupedActionItems.reduce((sum, group) => sum + group.items.length, 0)} action items from ${groupedActionItems.length} meeting session${groupedActionItems.length !== 1 ? 's' : ''}` : 
              'No action items to display'
            }
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

export default ActionTrackerModal;