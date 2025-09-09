import { createClient } from '@supabase/supabase-js';
import { db } from './database';
import { Meeting, Attachment, SyncStatus, SyncConflict } from '../types/meeting';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class SyncService {
  private static instance: SyncService;
  private supabase: any;
  private syncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    pendingChanges: 0,
    conflicts: [],
    isSyncing: false
  };
  private listeners: Array<(status: SyncStatus) => void> = [];

  private constructor() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.syncStatus.isOnline = true;
      this.notifyListeners();
      this.autoSync();
    });

    window.addEventListener('offline', () => {
      this.syncStatus.isOnline = false;
      this.notifyListeners();
    });

    // Auto-sync every 5 minutes when online
    setInterval(() => {
      if (this.syncStatus.isOnline && !this.syncStatus.isSyncing) {
        this.autoSync();
      }
    }, 5 * 60 * 1000);
  }

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  // Status management
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getSyncStatus()));
  }

  private async updatePendingChanges(): Promise<void> {
    const dirtyMeetings = await db.getDirtyMeetings();
    const dirtyAttachments = await db.getDirtyAttachments();
    this.syncStatus.pendingChanges = dirtyMeetings.length + dirtyAttachments.length;
  }

  // Auto-sync (non-blocking)
  private async autoSync(): Promise<void> {
    try {
      await this.sync();
    } catch (error) {
      console.warn('Auto-sync failed:', error);
    }
  }

  // Manual sync (with error propagation)
  async sync(): Promise<void> {
    if (!this.supabase || !this.syncStatus.isOnline || this.syncStatus.isSyncing) {
      return;
    }

    this.syncStatus.isSyncing = true;
    this.notifyListeners();

    try {
      console.log('Starting sync...');
      
      // Step 1: Pull remote changes
      await this.pullFromRemote();
      
      // Step 2: Push local changes
      await this.pushToRemote();
      
      // Step 3: Update sync status
      this.syncStatus.lastSyncAt = new Date().toISOString();
      await this.updatePendingChanges();
      
      console.log('Sync completed successfully');
      
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      this.syncStatus.isSyncing = false;
      this.notifyListeners();
    }
  }

  private async pullFromRemote(): Promise<void> {
    console.log('Pulling from remote...');
    
    // Get last sync timestamp
    const lastSync = this.syncStatus.lastSyncAt || '1970-01-01T00:00:00.000Z';
    
    // Pull meetings
    const { data: remoteMeetings, error: meetingsError } = await this.supabase
      .from('meetings')
      .select('*')
      .gte('updated_at', lastSync);
    
    if (meetingsError) {
      throw new Error(`Failed to pull meetings: ${meetingsError.message}`);
    }

    // Merge meetings
    for (const remoteMeeting of remoteMeetings || []) {
      await this.mergeMeeting(remoteMeeting);
    }

    // Pull attachments manifest
    const { data: remoteAttachments, error: attachmentsError } = await this.supabase
      .from('meeting_attachments')
      .select('*')
      .gte('updated_at', lastSync);
    
    if (attachmentsError) {
      throw new Error(`Failed to pull attachments: ${attachmentsError.message}`);
    }

    // Merge attachments
    for (const remoteAttachment of remoteAttachments || []) {
      await this.mergeAttachment(remoteAttachment);
    }
  }

  private async mergeMeeting(remoteMeeting: any): Promise<void> {
    const localMeeting = await db.getMeeting(remoteMeeting.id);
    
    if (!localMeeting) {
      // New remote meeting - add locally
      await db.meetings.add({
        id: remoteMeeting.id,
        title: remoteMeeting.title,
        date: remoteMeeting.date,
        participants: remoteMeeting.participants || [],
        notes: remoteMeeting.notes || '',
        attachments: remoteMeeting.attachments || [],
        isOnline: remoteMeeting.is_online || false,
        isOfflineRecorded: remoteMeeting.is_offline_recorded || false,
        createdAt: remoteMeeting.created_at,
        updatedAt: remoteMeeting.updated_at,
        version: remoteMeeting.version || 1,
        lastSyncedAt: new Date().toISOString(),
        isDirty: false
      });
      return;
    }

    // Check for conflicts (both have changes since last sync)
    const remoteUpdated = new Date(remoteMeeting.updated_at);
    const localUpdated = new Date(localMeeting.updatedAt);
    const lastSynced = localMeeting.lastSyncedAt ? new Date(localMeeting.lastSyncedAt) : new Date(0);

    if (localMeeting.isDirty && remoteUpdated > lastSynced) {
      // Conflict detected - store remote data for resolution
      await db.setMeetingConflict(remoteMeeting.id, {
        title: remoteMeeting.title,
        date: remoteMeeting.date,
        participants: remoteMeeting.participants || [],
        notes: remoteMeeting.notes || '',
        attachments: remoteMeeting.attachments || [],
        isOnline: remoteMeeting.is_online || false,
        isOfflineRecorded: remoteMeeting.is_offline_recorded || false,
        updatedAt: remoteMeeting.updated_at,
        version: remoteMeeting.version || 1
      });

      // Add to conflicts list
      this.syncStatus.conflicts.push({
        meetingId: remoteMeeting.id,
        field: 'title', // Simplified - in reality would detect specific fields
        localValue: localMeeting.title,
        remoteValue: remoteMeeting.title,
        localTimestamp: localMeeting.updatedAt,
        remoteTimestamp: remoteMeeting.updated_at
      });
      
      return;
    }

    // No conflict - apply last-write-wins
    if (remoteUpdated > localUpdated) {
      await db.meetings.update(remoteMeeting.id, {
        title: remoteMeeting.title,
        date: remoteMeeting.date,
        participants: remoteMeeting.participants || [],
        notes: remoteMeeting.notes || '',
        attachments: remoteMeeting.attachments || [],
        isOnline: remoteMeeting.is_online || false,
        isOfflineRecorded: remoteMeeting.is_offline_recorded || false,
        updatedAt: remoteMeeting.updated_at,
        version: remoteMeeting.version || 1,
        lastSyncedAt: new Date().toISOString(),
        isDirty: false
      });
    }
  }

  private async mergeAttachment(remoteAttachment: any): Promise<void> {
    const localAttachment = await db.attachments.get(remoteAttachment.id);
    
    if (!localAttachment) {
      // New remote attachment
      await db.attachments.add({
        id: remoteAttachment.id,
        meetingId: remoteAttachment.meeting_id,
        name: remoteAttachment.name,
        size: remoteAttachment.size,
        type: remoteAttachment.type,
        remoteUrl: remoteAttachment.url,
        uploadedAt: remoteAttachment.uploaded_at,
        createdAt: remoteAttachment.created_at,
        updatedAt: remoteAttachment.updated_at,
        version: remoteAttachment.version || 1,
        isDirty: false
      });
    }
  }

  private async pushToRemote(): Promise<void> {
    console.log('Pushing to remote...');
    
    // Push dirty meetings
    const dirtyMeetings = await db.getDirtyMeetings();
    for (const meeting of dirtyMeetings) {
      if (meeting.conflictData) {
        continue; // Skip meetings with unresolved conflicts
      }

      const { error } = await this.supabase
        .from('meetings')
        .upsert({
          id: meeting.id,
          title: meeting.title,
          date: meeting.date,
          participants: meeting.participants,
          notes: meeting.notes,
          attachments: meeting.attachments,
          is_online: meeting.isOnline,
          is_offline_recorded: meeting.isOfflineRecorded,
          created_at: meeting.createdAt,
          updated_at: meeting.updatedAt,
          version: meeting.version
        });

      if (error) {
        console.error(`Failed to push meeting ${meeting.id}:`, error);
        continue;
      }

      // Mark as clean
      await db.markMeetingClean(meeting.id, meeting.version, new Date().toISOString());
    }

    // Push dirty attachments
    const dirtyAttachments = await db.getDirtyAttachments();
    for (const attachment of dirtyAttachments) {
      // Upload blob to storage if exists
      let remoteUrl = attachment.remoteUrl;
      if (attachment.localBlob && !remoteUrl) {
        const fileName = `${attachment.meetingId}/${attachment.id}-${attachment.name}`;
        const { data, error: uploadError } = await this.supabase.storage
          .from('meeting-attachments')
          .upload(fileName, attachment.localBlob);

        if (uploadError) {
          console.error(`Failed to upload attachment ${attachment.id}:`, uploadError);
          continue;
        }

        remoteUrl = data.path;
      }

      // Update attachment manifest
      const { error } = await this.supabase
        .from('meeting_attachments')
        .upsert({
          id: attachment.id,
          meeting_id: attachment.meetingId,
          name: attachment.name,
          size: attachment.size,
          type: attachment.type,
          url: remoteUrl,
          uploaded_at: attachment.uploadedAt,
          created_at: attachment.createdAt,
          updated_at: attachment.updatedAt,
          version: attachment.version
        });

      if (error) {
        console.error(`Failed to push attachment ${attachment.id}:`, error);
        continue;
      }

      // Mark as clean
      await db.markAttachmentClean(attachment.id, attachment.version);
    }
  }

  // Conflict resolution
  async resolveConflict(meetingId: string, useLocal: boolean): Promise<void> {
    const meeting = await db.getMeeting(meetingId);
    if (!meeting || !meeting.conflictData) {
      return;
    }

    if (useLocal) {
      // Keep local version, mark as dirty for next sync
      await db.resolveMeetingConflict(meetingId, {});
    } else {
      // Accept remote version
      await db.resolveMeetingConflict(meetingId, meeting.conflictData);
    }

    // Remove from conflicts list
    this.syncStatus.conflicts = this.syncStatus.conflicts.filter(
      conflict => conflict.meetingId !== meetingId
    );
    this.notifyListeners();
  }

  async getConflicts(): Promise<Meeting[]> {
    return await db.getMeetingsWithConflicts();
  }
}

// Export singleton instance
export const syncService = SyncService.getInstance();