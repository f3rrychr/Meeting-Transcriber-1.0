import Dexie, { Table } from 'dexie';
import { Meeting, Attachment } from '../types/meeting';

export class MeetingDatabase extends Dexie {
  meetings!: Table<Meeting>;
  attachments!: Table<Attachment>;

  constructor() {
    super('MeetingDatabase');
    
    this.version(1).stores({
      meetings: 'id, title, date, createdAt, updatedAt, version, isDirty, lastSyncedAt',
      attachments: 'id, meetingId, name, createdAt, updatedAt, version, isDirty'
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
}

// Singleton instance
export const db = new MeetingDatabase();