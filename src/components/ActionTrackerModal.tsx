import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, User, FileText, Check, Clock, AlertTriangle } from 'lucide-react';
import { TranscriptionRecord, ActionItem } from '../types';
import { TranscriptionStorage } from '../utils/storageUtils';

interface ActionTrackerModalProps {
  onClose: () => void;
}

interface ActionItemWithSource extends ActionItem {
  sourceId: string;
  sourceMeeting: string;
  sourceDate: string;
  status: 'pending' | 'completed' | 'overdue';
}

const ActionTrackerModal: React.FC<ActionTrackerModalProps> = ({ onClose }) => {
  const [actionItems, setActionItems] = useState<ActionItemWithSource[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');

  useEffect(() => {
    // Load all transcription records and extract action items
    const records = TranscriptionStorage.getTranscriptions();
    const allActionItems: ActionItemWithSource[] = [];

    records.forEach(record => {
      record.summary.actionItems.forEach(item => {
        const dueDate = new Date(item.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        let status: 'pending' | 'completed' | 'overdue' = 'pending';
        if (dueDate < today) {
          status = 'overdue';
        }

        allActionItems.push({
          ...item,
          sourceId: record.id,
          sourceMeeting: record.title,
          sourceDate: record.date,
          status
        });
      });
    });

    // Sort by due date (earliest first)
    allActionItems.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    setActionItems(allActionItems);
  }, []);

  const filteredItems = actionItems.filter(item => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Check className="w-3 h-3 mr-1" />
            Completed
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
    }
  };

  const getStatusCounts = () => {
    const counts = {
      all: actionItems.length,
      pending: actionItems.filter(item => item.status === 'pending').length,
      completed: actionItems.filter(item => item.status === 'completed').length,
      overdue: actionItems.filter(item => item.status === 'overdue').length
    };
    return counts;
  };

  const statusCounts = getStatusCounts();

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

        {/* Filter Tabs */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex space-x-1">
            {[
              { key: 'all', label: 'All', count: statusCounts.all },
              { key: 'pending', label: 'Pending', count: statusCounts.pending },
              { key: 'overdue', label: 'Overdue', count: statusCounts.overdue },
              { key: 'completed', label: 'Completed', count: statusCounts.completed }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  filter === tab.key
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                    filter === tab.key
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-6">
          {filteredItems.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                        No
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
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          Source
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredItems.map((item, index) => (
                      <tr key={`${item.sourceId}-${index}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                          <div className="break-words">
                            {item.task}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            {item.assignee}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            <span className={`font-medium ${
                              item.status === 'overdue' ? 'text-red-600' : 
                              item.status === 'completed' ? 'text-green-600' : 'text-gray-900'
                            }`}>
                              {new Date(item.dueDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700 max-w-xs">
                          <div className="break-words">
                            {item.remarks || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900 truncate max-w-32" title={item.sourceMeeting}>
                              {item.sourceMeeting}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(item.sourceDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'all' ? 'No Action Items Found' : `No ${filter.charAt(0).toUpperCase() + filter.slice(1)} Action Items`}
              </h3>
              <p className="text-gray-500">
                {filter === 'all' 
                  ? 'Action items from your transcription sessions will appear here.'
                  : `No action items with ${filter} status found.`
                }
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Showing {filteredItems.length} of {actionItems.length} action items
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