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
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    const loadActionItems = () => {
      let debugLog = 'Action Tracker Debug Log:\n';
      try {
        // Load all transcription records
        const records = TranscriptionStorage.getTranscriptions();
        debugLog += `Found ${records.length} transcription records\n`;
        setTotalRecords(records.length);
        console.log('ActionTracker: Loading action items from', records.length, 'records');
        console.log('ActionTracker: Raw records:', records);
        
        const allActionItems: ActionItemWithSource[] = [];

        records.forEach((record, recordIndex) => {
          debugLog += `\nRecord ${recordIndex + 1}:\n`;
          debugLog += `  ID: ${record.id}\n`;
          debugLog += `  Title: ${record.title}\n`;
          debugLog += `  Date: ${record.date}\n`;
          debugLog += `  Has Summary: ${!!record.summary}\n`;
          
          const recordDebug = {
            id: record.id,
            title: record.title,
            date: record.date,
            hasSummary: !!record.summary,
            hasActionItems: !!(record.summary?.actionItems),
            actionItemsLength: record.summary?.actionItems?.length || 0,
            actionItems: record.summary?.actionItems
          };
          console.log(`ActionTracker: Processing record ${recordIndex}:`, recordDebug);
          
          if (record.summary && record.summary.actionItems && Array.isArray(record.summary.actionItems)) {
            debugLog += `  Action Items: ${record.summary.actionItems.length}\n`;
            record.summary.actionItems.forEach((item, itemIndex) => {
              debugLog += `    ${itemIndex + 1}. ${item.task} (${item.assignee})\n`;
              console.log(`ActionTracker: Processing action item ${itemIndex}:`, item);
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
          } else {
            debugLog += `  No action items found\n`;
            const noActionItemsDebug = {
              hasSummary: !!record.summary,
              summaryKeys: record.summary ? Object.keys(record.summary) : [],
              actionItems: record.summary?.actionItems
            };
            console.log(`ActionTracker: Record ${recordIndex} has no valid action items:`, noActionItemsDebug);
          }
        });

        debugLog += `\nTotal Action Items Found: ${allActionItems.length}\n`;
        console.log('ActionTracker: Total action items found:', allActionItems.length);
        console.log('ActionTracker: All action items:', allActionItems);

        // Group action items by date
        const groupedByDate = allActionItems.reduce((groups, item) => {
          const date = item.sourceDate;
          if (!groups[date]) {
            groups[date] = [];
          }
          groups[date].push(item);
          return groups;
        }, {} as Record<string, ActionItemWithSource[]>);

        debugLog += `Grouped into ${Object.keys(groupedByDate).length} date groups\n`;
        console.log('ActionTracker: Grouped by date:', groupedByDate);

        // Convert to array and sort by date (most recent first)
        const groupedArray: GroupedActionItems[] = Object.entries(groupedByDate)
          .map(([date, items]) => ({ date, items }))
          .sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB.getTime() - dateA.getTime();
          });
        
        debugLog += `Final grouped array length: ${groupedArray.length}\n`;
        console.log('ActionTracker: Final grouped action items:', groupedArray);
        setDebugInfo(debugLog);
        setGroupedActionItems(groupedArray);
      } catch (error) {
        debugLog += `Error: ${error}\n`;
        console.error('Error loading action items:', error);
        setGroupedActionItems([]);
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
            <>
              {/* Debug Info - Remove this after fixing */}
              <details className="mb-4 p-3 bg-gray-50 rounded border">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">
                  Debug Information (Click to expand)
                </summary>
                <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {debugInfo}
                </pre>
                <div className="mt-2 text-xs text-gray-600">
                  <p>Grouped Action Items State: {JSON.stringify(groupedActionItems, null, 2)}</p>
                </div>
              </details>
              
              {/* Show raw localStorage data for debugging */}
              <details className="mb-4 p-3 bg-blue-50 rounded border">
                <summary className="cursor-pointer text-sm font-medium text-blue-700">
                  Raw localStorage Data (Click to expand)
                </summary>
                <pre className="mt-2 text-xs text-blue-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {JSON.stringify(TranscriptionStorage.getTranscriptions(), null, 2)}
                </pre>
              </details>

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
                      // Calculate starting counter for this group
                      const startingCounter = groupedActionItems
                        .slice(0, groupIndex)
                        .reduce((sum, g) => sum + g.items.length, 0) + 1;
                      
                      return group.items.map((item, itemIndex) => {
                        const currentItemNumber = startingCounter + itemIndex;
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
                                  <span className="ml-2 text-xs text-gray-500">
                                    ({group.items.length} item{group.items.length !== 1 ? 's' : ''})
                                  </span>
                                </div>
                              )}
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
            </>
          ) : (
            <>
              {/* Debug Info for empty state */}
              <details className="mb-4 p-3 bg-yellow-50 rounded border">
                <summary className="cursor-pointer text-sm font-medium text-yellow-700">
                  Debug Information - No Action Items (Click to expand)
                </summary>
                <pre className="mt-2 text-xs text-yellow-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {debugInfo}
                </pre>
                <div className="mt-2 text-xs text-yellow-600">
                  <p>Raw Records: {JSON.stringify(TranscriptionStorage.getTranscriptions(), null, 2)}</p>
                </div>
              </details>
              
            <div className="text-center py-12">
              <CheckSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {totalRecords > 0 ? 'No Action Items in Meeting Records' : 'No Action Items Found'}
              </h3>
              <p className="text-gray-500 mb-2">
                {totalRecords > 0 
                  ? `Found ${totalRecords} meeting record${totalRecords !== 1 ? 's' : ''}, but none contain action items.`
                  : 'Action items from your transcription sessions will appear here.'
                }
              </p>
              {totalRecords > 0 ? (
                <div className="text-sm text-gray-400 space-y-1">
                  <p>This can happen when:</p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>Meetings were informal discussions without specific tasks</li>
                    <li>The AI didn't identify clear action items in the conversation</li>
                    <li>The meeting content was too brief for action item extraction</li>
                  </ul>
                  <p className="mt-3 font-medium text-gray-600">
                    Try processing longer, more structured meeting recordings for better action item detection.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 mt-2">
                  Process some meeting audio files to see action items here.
                </p>
              )}
            </div>
            </>
          )}
        </div>
        
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {groupedActionItems.length > 0 ? 
              `Showing ${groupedActionItems.reduce((sum, group) => sum + group.items.length, 0)} action items from ${groupedActionItems.length} meeting session${groupedActionItems.length !== 1 ? 's' : ''}` : 
              totalRecords > 0 ? 
                `${totalRecords} meeting record${totalRecords !== 1 ? 's' : ''} found, but no action items detected` :
                'No action items to display'
            }
          </div>
          {totalRecords > 0 && groupedActionItems.length === 0 && (
            <button
              onClick={() => {
                // Add sample action items for testing
                const sampleActionItems: GroupedActionItems[] = [{
                  date: '2025-09-02',
                  items: [
                    {
                      task: 'Follow up on municipal board order compliance',
                      assignee: 'Mayor Patrick Terry',
                      dueDate: '2025-09-10',
                      remarks: 'Ensure all requirements are met',
                      sourceId: '1756807348347',
                      sourceMeeting: '2023-06-13 Special Council Meeting',
                      sourceDate: '2025-09-02'
                    },
                    {
                      task: 'Review development agreement with legal counsel',
                      assignee: 'Council Legal Team',
                      dueDate: '2025-09-15',
                      remarks: 'Address public concerns raised',
                      sourceId: '1756807348347',
                      sourceMeeting: '2023-06-13 Special Council Meeting',
                      sourceDate: '2025-09-02'
                    }
                  ]
                }];
                setGroupedActionItems(sampleActionItems);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              Add Sample Data
            </button>
          )}
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