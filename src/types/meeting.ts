export interface FileRef {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  localPath?: string;
  uploadedAt?: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string; // ISO date string
  participants: string[];
  notes: string;
  attachments: FileRef[];
  isOnline: boolean;
  isOfflineRecorded: boolean;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  version: number;
  // Sync metadata
  lastSyncedAt?: string;
  isDirty?: boolean; // Has local changes not synced
  conflictData?: Partial<Meeting>; // Remote data in case of conflict
}

export interface Attachment {
  id: string;
  meetingId: string;
  name: string;
  size: number;
  type: string;
  localBlob?: Blob;
  remoteUrl?: string;
  uploadedAt?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  isDirty?: boolean;
}

export interface SyncConflict {
  meetingId: string;
  field: keyof Meeting;
  localValue: any;
  remoteValue: any;
  localTimestamp: string;
  remoteTimestamp: string;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncAt?: string;
  pendingChanges: number;
  conflicts: SyncConflict[];
  isSyncing: boolean;
}