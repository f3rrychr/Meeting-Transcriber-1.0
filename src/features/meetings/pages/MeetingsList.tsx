import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Users, Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { Meeting, SyncStatus } from '../../../types/meeting';
import { db } from '../../../services/database';
import { syncService } from '../../../services/syncService';

interface MeetingsListProps {
  onCreateMeeting: () => void;
  onEditMeeting: (meeting: Meeting) => void;
  onViewMeeting: (meeting: Meeting) => void;
}

const MeetingsList: React.FC<MeetingsListProps> = ({
  onCreateMeeting,
  onEditMeeting,
  onViewMeeting
}) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncService.getSyncStatus());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadMeetings();
    
    // Subscribe to sync status changes
    const unsubscribe = syncService.onSyncStatusChange(setSyncStatus);
    
    return unsubscribe;
  }, []);

  const loadMeetings = async () => {
    try {
      const allMeetings = await db.getAllMeetings();
      setMeetings(allMeetings);
    } catch (error) {
      console.error('Failed to load meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (syncing || !syncStatus.isOnline) return;
    
    setSyncing(true);
    try {
      await syncService.sync();
      await loadMeetings(); // Refresh list after sync
    } catch (error) {
      console.error('Sync failed:', error);
      // Could show error toast here
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMeetingStatusIcon = (meeting: Meeting) => {
    if (meeting.conflictData) {
      return <AlertTriangle className="w-4 h-4 text-amber-500" title="Has conflicts" />;
    }
    if (meeting.isDirty) {
      return <RefreshCw className="w-4 h-4 text-blue-500" title="Pending sync" />;
    }
    if (meeting.isOnline) {
      return <Wifi className="w-4 h-4 text-green-500" title="Online meeting" />;
    }
    return <WifiOff className="w-4 h-4 text-gray-500" title="Offline meeting" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="text-gray-600 mt-1">
            {meetings.length} meetings • {syncStatus.pendingChanges} pending changes
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Sync Status */}
          <div className="flex items-center space-x-2 text-sm">
            {syncStatus.isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className={syncStatus.isOnline ? 'text-green-600' : 'text-red-600'}>
              {syncStatus.isOnline ? 'Online' : 'Offline'}
            </span>
            {syncStatus.lastSyncAt && (
              <span className="text-gray-500">
                • Last sync: {new Date(syncStatus.lastSyncAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={!syncStatus.isOnline || syncing}
            className="flex items-center px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>

          {/* Create Button */}
          <button
            onClick={onCreateMeeting}
            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Meeting
          </button>
        </div>
      </div>

      {/* Conflicts Alert */}
      {syncStatus.conflicts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-amber-600 mr-2" />
            <div>
              <h3 className="font-medium text-amber-900">
                {syncStatus.conflicts.length} meeting{syncStatus.conflicts.length !== 1 ? 's' : ''} need{syncStatus.conflicts.length === 1 ? 's' : ''} conflict resolution
              </h3>
              <p className="text-sm text-amber-800 mt-1">
                Click on meetings with the warning icon to resolve conflicts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Meetings Grid */}
      {meetings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className={`bg-white rounded-lg border-2 p-6 hover:shadow-md transition-all cursor-pointer ${
                meeting.conflictData ? 'border-amber-300 bg-amber-50' : 
                meeting.isDirty ? 'border-blue-300' : 'border-gray-200'
              }`}
              onClick={() => onViewMeeting(meeting)}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                  {meeting.title}
                </h3>
                {getMeetingStatusIcon(meeting)}
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  {formatDate(meeting.date)}
                </div>
                
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  {meeting.participants.length} participant{meeting.participants.length !== 1 ? 's' : ''}
                </div>
                
                {meeting.notes && (
                  <p className="text-gray-700 line-clamp-2 mt-3">
                    {meeting.notes}
                  </p>
                )}
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  {meeting.attachments.length > 0 && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {meeting.attachments.length} file{meeting.attachments.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {meeting.isOfflineRecorded && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                      Recorded
                    </span>
                  )}
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditMeeting(meeting);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings yet</h3>
          <p className="text-gray-500 mb-6">
            Create your first meeting to get started with hybrid meeting management.
          </p>
          <button
            onClick={onCreateMeeting}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Meeting
          </button>
        </div>
      )}
    </div>
  );
};

export default MeetingsList;