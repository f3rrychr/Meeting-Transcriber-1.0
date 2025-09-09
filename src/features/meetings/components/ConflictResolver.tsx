import React, { useState } from 'react';
import { X, AlertTriangle, Check, ArrowRight } from 'lucide-react';
import { Meeting } from '../../../types/meeting';
import { syncService } from '../../../services/syncService';

interface ConflictResolverProps {
  meeting: Meeting;
  onResolve: () => void;
  onClose: () => void;
}

interface FieldComparison {
  field: keyof Meeting;
  label: string;
  localValue: any;
  remoteValue: any;
  selectedValue: 'local' | 'remote';
}

const ConflictResolver: React.FC<ConflictResolverProps> = ({
  meeting,
  onResolve,
  onClose
}) => {
  const [resolving, setResolving] = useState(false);
  const [comparisons, setComparisons] = useState<FieldComparison[]>(() => {
    if (!meeting.conflictData) return [];

    const fields: Array<{ field: keyof Meeting; label: string }> = [
      { field: 'title', label: 'Title' },
      { field: 'date', label: 'Date & Time' },
      { field: 'participants', label: 'Participants' },
      { field: 'notes', label: 'Notes' },
      { field: 'isOnline', label: 'Online Meeting' },
      { field: 'isOfflineRecorded', label: 'Recorded Meeting' }
    ];

    return fields
      .filter(({ field }) => {
        const localValue = meeting[field];
        const remoteValue = meeting.conflictData![field];
        return JSON.stringify(localValue) !== JSON.stringify(remoteValue);
      })
      .map(({ field, label }) => ({
        field,
        label,
        localValue: meeting[field],
        remoteValue: meeting.conflictData![field],
        selectedValue: 'local' as 'local' | 'remote'
      }));
  });

  const handleFieldSelection = (index: number, selection: 'local' | 'remote') => {
    setComparisons(prev => prev.map((comp, i) => 
      i === index ? { ...comp, selectedValue: selection } : comp
    ));
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      // Build resolved data from selections
      const resolvedData: Partial<Meeting> = {};
      
      comparisons.forEach(({ field, selectedValue, localValue, remoteValue }) => {
        resolvedData[field] = selectedValue === 'local' ? localValue : remoteValue;
      });

      // Apply resolution
      await syncService.resolveConflict(meeting.id, false); // We're handling the merge manually
      
      // Update the meeting with resolved data
      const { db } = await import('../../../services/database');
      await db.resolveMeetingConflict(meeting.id, resolvedData);
      
      onResolve();
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setResolving(false);
    }
  };

  const formatValue = (value: any, field: keyof Meeting): string => {
    if (value === null || value === undefined) return 'Not set';
    
    switch (field) {
      case 'date':
        return new Date(value).toLocaleString();
      case 'participants':
        return Array.isArray(value) ? value.join(', ') : String(value);
      case 'isOnline':
      case 'isOfflineRecorded':
        return value ? 'Yes' : 'No';
      default:
        return String(value);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (comparisons.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="text-center">
            <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Conflicts Found</h2>
            <p className="text-gray-600 mb-4">
              This meeting doesn't have any conflicting changes.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-amber-500 mr-3" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Resolve Sync Conflicts</h2>
              <p className="text-sm text-gray-600 mt-1">
                Choose which version to keep for each conflicting field
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Meeting Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">{meeting.title}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Local version: Modified {formatTimestamp(meeting.updatedAt)}</p>
              <p>Remote version: Modified {formatTimestamp(meeting.conflictData?.updatedAt || '')}</p>
            </div>
          </div>

          {/* Conflict Resolution */}
          <div className="space-y-6">
            {comparisons.map((comparison, index) => (
              <div key={comparison.field} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-4">{comparison.label}</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Local Version */}
                  <div
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      comparison.selectedValue === 'local'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleFieldSelection(index, 'local')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">Local Version</span>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        comparison.selectedValue === 'local'
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}>
                        {comparison.selectedValue === 'local' && (
                          <div className="w-full h-full rounded-full bg-white scale-50"></div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      Modified {formatTimestamp(meeting.updatedAt)}
                    </div>
                    <div className="text-gray-900 bg-white p-3 rounded border">
                      {formatValue(comparison.localValue, comparison.field)}
                    </div>
                  </div>

                  {/* Remote Version */}
                  <div
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      comparison.selectedValue === 'remote'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleFieldSelection(index, 'remote')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">Remote Version</span>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        comparison.selectedValue === 'remote'
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300'
                      }`}>
                        {comparison.selectedValue === 'remote' && (
                          <div className="w-full h-full rounded-full bg-white scale-50"></div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      Modified {formatTimestamp(meeting.conflictData?.updatedAt || '')}
                    </div>
                    <div className="text-gray-900 bg-white p-3 rounded border">
                      {formatValue(comparison.remoteValue, comparison.field)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Resolution Summary</h4>
            <div className="text-sm text-blue-800 space-y-1">
              {comparisons.map((comp, index) => (
                <div key={comp.field} className="flex items-center">
                  <span className="w-24">{comp.label}:</span>
                  <ArrowRight className="w-4 h-4 mx-2" />
                  <span className={`font-medium ${
                    comp.selectedValue === 'local' ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    {comp.selectedValue === 'local' ? 'Local' : 'Remote'} version
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors"
          >
            <Check className="w-4 h-4 mr-2" />
            {resolving ? 'Resolving...' : 'Apply Resolution'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolver;