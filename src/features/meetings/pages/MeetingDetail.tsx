import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Users, Calendar, FileText, Download, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Meeting, Attachment } from '../../../types/meeting';
import { db } from '../../../services/database';
import { syncService } from '../../../services/syncService';

interface MeetingDetailProps {
  meetingId: string;
  onBack: () => void;
  onEdit: (meeting: Meeting) => void;
  onShowConflictResolver: (meeting: Meeting) => void;
}

const MeetingDetail: React.FC<MeetingDetailProps> = ({
  meetingId,
  onBack,
  onEdit,
  onShowConflictResolver
}) => {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMeeting();
  }, [meetingId]);

  const loadMeeting = async () => {
    try {
      const meetingData = await db.getMeeting(meetingId);
      if (meetingData) {
        setMeeting(meetingData);
        const attachmentData = await db.getAttachmentsByMeeting(meetingId);
        setAttachments(attachmentData);
      }
    } catch (error) {
      console.error('Failed to load meeting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      let blob: Blob;
      
      if (attachment.localBlob) {
        blob = attachment.localBlob;
      } else if (attachment.remoteUrl) {
        // Download from remote URL
        const response = await fetch(attachment.remoteUrl);
        blob = await response.blob();
      } else {
        console.error('No blob or URL available for attachment');
        return;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download attachment:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Meeting not found</h3>
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to meetings
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
              <span>Created {formatDate(meeting.createdAt)}</span>
              {meeting.updatedAt !== meeting.createdAt && (
                <span>• Updated {formatDate(meeting.updatedAt)}</span>
              )}
              {meeting.isDirty && (
                <span className="flex items-center text-blue-600">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Pending sync
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {meeting.conflictData && (
            <button
              onClick={() => onShowConflictResolver(meeting)}
              className="flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Resolve Conflicts
            </button>
          )}
          
          <button
            onClick={() => onEdit(meeting)}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Meeting
          </button>
        </div>
      </div>

      {/* Conflict Alert */}
      {meeting.conflictData && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900">Sync Conflict Detected</h3>
              <p className="text-sm text-amber-800 mt-1">
                This meeting has been modified both locally and remotely. 
                Click "Resolve Conflicts" to choose which version to keep.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Meeting Details</h2>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <Calendar className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Date & Time</p>
                  <p className="text-gray-600">{formatDate(meeting.date)}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Users className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                <div>
                  <p className="font-medium text-gray-900 mb-2">
                    Participants ({meeting.participants.length})
                  </p>
                  <div className="space-y-1">
                    {meeting.participants.map((participant, index) => (
                      <div key={index} className="flex items-center">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mr-2" />
                        <span className="text-gray-700">{participant}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${meeting.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <span className="text-sm text-gray-600">
                    {meeting.isOnline ? 'Online Meeting' : 'In-Person Meeting'}
                  </span>
                </div>
                
                {meeting.isOfflineRecorded && (
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-400 rounded-full mr-2" />
                    <span className="text-sm text-gray-600">Recorded</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {meeting.notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{meeting.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Attachments */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Attachments ({attachments.length})
            </h2>
            
            {attachments.length > 0 ? (
              <div className="space-y-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(attachment.size)}
                        {attachment.uploadedAt && (
                          <span> • {new Date(attachment.uploadedAt).toLocaleDateString()}</span>
                        )}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => handleDownloadAttachment(attachment)}
                      className="ml-3 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No attachments</p>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <span className="font-medium">{meeting.version}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="font-medium">
                  {new Date(meeting.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Last Modified:</span>
                <span className="font-medium">
                  {new Date(meeting.updatedAt).toLocaleDateString()}
                </span>
              </div>
              
              {meeting.lastSyncedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Synced:</span>
                  <span className="font-medium">
                    {new Date(meeting.lastSyncedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-600">Sync Status:</span>
                <span className={`font-medium ${meeting.isDirty ? 'text-blue-600' : 'text-green-600'}`}>
                  {meeting.isDirty ? 'Pending' : 'Synced'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingDetail;