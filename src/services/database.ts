import Dexie, { Table } from 'dexie';
import { Meeting, Attachment } from '../types/meeting';
import { ActionItem } from '../types/action';

export class MeetingDatabase extends Dexie {
  meetings!: Table<Meeting>;
  attachments!: Table<Attachment>;
  actionItems!: Table<ActionItem>;

  constructor() {
    super('MeetingDatabase');
    
    this.version(1).stores({
      meetings: 'id, title, date, createdAt, updatedAt, version, isDirty, lastSyncedAt',
      attachments: 'id, meetingId, name, createdAt, updatedAt, version, isDirty',
      actionItems: 'id, no, meeting, pic, dueDate, status, createdAt, updatedAt, isDirty'
    });

    // Hooks for automatic timestamp updates
    this.meetings.hook('creating', (primKey, obj, trans) => {
      const now = new Date().toISOString();
      obj.createdAt = now;
      obj.updatedAt = now;
      obj.version = 1;
      obj.isDirty = true;
    });

    this.meetings.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.updatedAt = new Date().toISOString();
      modifications.version = (obj.version || 0) + 1;
      modifications.isDirty = true;
    });

    this.attachments.hook('creating', (primKey, obj, trans) => {
      const now = new Date().toISOString();
      obj.createdAt = now;
      obj.updatedAt = now;
      obj.version = 1;
      obj.isDirty = true;
    });

    this.attachments.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.updatedAt = new Date().toISOString();
      modifications.version = (obj.version || 0) + 1;
      modifications.isDirty = true;
    });

    this.actionItems.hook('creating', (primKey, obj, trans) => {
      const now = new Date().toISOString();
      obj.createdAt = now;
      obj.updatedAt = now;
      obj.isDirty = true;
    });

    this.actionItems.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.updatedAt = new Date().toISOString();
      modifications.isDirty = true;
    });
  }

  // Meeting operations
  async createMeeting(meeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<string> {
    const id = crypto.randomUUID();
    await this.meetings.add({
      ...meeting,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      isDirty: true
    });
    return id;
  }

  async updateMeeting(id: string, updates: Partial<Meeting>): Promise<void> {
    await this.meetings.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
      isDirty: true
    });
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    return await this.meetings.get(id);
  }

  async getAllMeetings(): Promise<Meeting[]> {
    return await this.meetings.orderBy('date').reverse().toArray();
  }

  async getDirtyMeetings(): Promise<Meeting[]> {
    return await this.meetings.where('isDirty').equals(1).toArray();
  }

  async markMeetingClean(id: string, version: number, lastSyncedAt: string): Promise<void> {
    await this.meetings.update(id, {
      isDirty: false,
      version,
      lastSyncedAt
    });
  }

  // Attachment operations
  async createAttachment(attachment: Omit<Attachment, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<string> {
    const id = crypto.randomUUID();
    await this.attachments.add({
      ...attachment,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      isDirty: true
    });
    return id;
  }

  async getAttachmentsByMeeting(meetingId: string): Promise<Attachment[]> {
    return await this.attachments.where('meetingId').equals(meetingId).toArray();
  }

  async getDirtyAttachments(): Promise<Attachment[]> {
    return await this.attachments.where('isDirty').equals(1).toArray();
  }

  async markAttachmentClean(id: string, version: number): Promise<void> {
    await this.attachments.update(id, {
      isDirty: false,
      version
    });
  }

  // Conflict resolution
  async setMeetingConflict(id: string, conflictData: Partial<Meeting>): Promise<void> {
    await this.meetings.update(id, { conflictData });
  }

  async resolveMeetingConflict(id: string, resolvedData: Partial<Meeting>): Promise<void> {
    await this.meetings.update(id, {
      ...resolvedData,
      conflictData: undefined,
      updatedAt: new Date().toISOString(),
      isDirty: true
    });
  }

  async getMeetingsWithConflicts(): Promise<Meeting[]> {
    return await this.meetings.where('conflictData').above('').toArray();
  }

  // Action Items operations
  async createActionItem(actionItem: Omit<ActionItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    await this.actionItems.add({
      ...actionItem,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDirty: true
    });
    return id;
  }

  async updateActionItem(id: string, updates: Partial<ActionItem>): Promise<void> {
    await this.actionItems.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
      isDirty: true
    });
  }

  async getActionItem(id: string): Promise<ActionItem | undefined> {
    return await this.actionItems.get(id);
  }

  async getAllActionItems(): Promise<ActionItem[]> {
    return await this.actionItems.orderBy('no').toArray();
  }

  async getActionItemsByMeeting(meeting: string): Promise<ActionItem[]> {
    return await this.actionItems.where('meeting').equals(meeting).toArray();
  }

  async getDirtyActionItems(): Promise<ActionItem[]> {
    return await this.actionItems.where('isDirty').equals(1).toArray();
  }

  async markActionItemClean(id: string): Promise<void> {
    await this.actionItems.update(id, { isDirty: false });
  }

  async deleteActionItem(id: string): Promise<void> {
    await this.actionItems.delete(id);
  }

  // Health check method
  async healthCheck(): Promise<{ isHealthy: boolean; error?: string }> {
    try {
      // Test basic database operations
      await this.meetings.limit(1).toArray();
      await this.actionItems.limit(1).toArray();
      await this.attachments.limit(1).toArray();
      
      return { isHealthy: true };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { 
        isHealthy: false, 
        error: error instanceof Error ? error.message : 'Unknown database error' 
      };
    }
  }
}

// Singleton instance
export const db = new MeetingDatabase();