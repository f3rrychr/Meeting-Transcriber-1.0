import { TranscriptionRecord, TranscriptData, SummaryData } from '../types';

const STORAGE_KEY = 'meeting-transcriber-history';
const STORAGE_SETTINGS_KEY = 'meeting-transcriber-settings';

// Storage limits
const MAX_RECORDS = 50;
const MAX_STORAGE_SIZE_MB = 2;
const MAX_STORAGE_SIZE_BYTES = MAX_STORAGE_SIZE_MB * 1024 * 1024;

interface StorageSettings {
  lastCleanup: number;
  totalRecords: number;
  estimatedSize: number;
}

export class TranscriptionStorage {
  /**
   * Initialize storage and perform cleanup on startup
   */
  static initialize(): void {
    console.log('Initializing TranscriptionStorage...');
    this.performStartupCleanup();
  }

  /**
   * Perform cleanup on application startup
   */
  private static performStartupCleanup(): void {
    try {
      const records = this.getTranscriptions();
      const currentSize = this.calculateStorageSize();
      
      console.log(`Storage startup check: ${records.length} records, ${Math.round(currentSize / 1024)}KB used`);
      
      // Auto-prune if over limits
      if (records.length > MAX_RECORDS || currentSize > MAX_STORAGE_SIZE_BYTES) {
        console.log('Storage limits exceeded, performing auto-prune...');
        this.pruneOldRecords();
      }
      
      // Update settings
      this.updateStorageSettings();
    } catch (error) {
      console.error('Failed to perform startup cleanup:', error);
    }
  }

  /**
   * Save a transcription record to localStorage
   */
  static saveTranscription(
    fileName: string,
    transcript: TranscriptData,
    summary: SummaryData
  ): void {
    try {
      const records = this.getTranscriptions();
      
      const newRecord: TranscriptionRecord = {
        id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        title: transcript.meetingTitle,
        transcript,
        summary,
        fileName,
        createdAt: Date.now()
      };
      
      // Add to beginning of array (most recent first)
      records.unshift(newRecord);
      
      // Apply LRU cap and size limits
      const trimmedRecords = this.applyLRUCap(records);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedRecords));
      this.updateStorageSettings();
      console.log('Transcription record saved:', newRecord.title);
    } catch (error) {
      console.error('Failed to save transcription record:', error);
    }
  }
  
  /**
   * Apply LRU (Least Recently Used) capping
   */
  private static applyLRUCap(records: TranscriptionRecord[]): TranscriptionRecord[] {
    // Sort by creation time (most recent first)
    const sortedRecords = records.sort((a, b) => b.createdAt - a.createdAt);
    
    // Apply record count limit
    let cappedRecords = sortedRecords.slice(0, MAX_RECORDS);
    
    // Apply size limit
    let currentSize = this.calculateRecordsSize(cappedRecords);
    while (currentSize > MAX_STORAGE_SIZE_BYTES && cappedRecords.length > 1) {
      cappedRecords.pop(); // Remove oldest record
      currentSize = this.calculateRecordsSize(cappedRecords);
    }
    
    if (cappedRecords.length < records.length) {
      console.log(`LRU cap applied: ${records.length} → ${cappedRecords.length} records`);
    }
    
    return cappedRecords;
  }

  /**
   * Get all transcription records from localStorage
   */
  static getTranscriptions(): TranscriptionRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load transcription records:', error);
    }
    return [];
  }
  
  /**
   * Get a specific transcription record by ID
   */
  static getTranscriptionById(id: string): TranscriptionRecord | null {
    const records = this.getTranscriptions();
    return records.find(record => record.id === id) || null;
  }
  
  /**
   * Delete a transcription record by ID
   */
  static deleteTranscription(id: string): void {
    try {
      const records = this.getTranscriptions();
      const filteredRecords = records.filter(record => record.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRecords));
      console.log('Transcription record deleted:', id);
    } catch (error) {
      console.error('Failed to delete transcription record:', error);
    }
  }
  
  /**
   * Prune old records to stay within limits
   */
  static pruneOldRecords(): { removed: number; sizeSaved: number } {
    try {
      const records = this.getTranscriptions();
      const originalSize = this.calculateStorageSize();
      const originalCount = records.length;
      
      const prunedRecords = this.applyLRUCap(records);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prunedRecords));
      this.updateStorageSettings();
      
      const newSize = this.calculateStorageSize();
      const removed = originalCount - prunedRecords.length;
      const sizeSaved = originalSize - newSize;
      
      console.log(`Pruned ${removed} records, saved ${Math.round(sizeSaved / 1024)}KB`);
      
      return { removed, sizeSaved };
    } catch (error) {
      console.error('Failed to prune old records:', error);
      return { removed: 0, sizeSaved: 0 };
    }
  }

  /**
   * Clear all transcription records
   */
  static clearAllTranscriptions(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      this.updateStorageSettings();
      console.log('All transcription records cleared');
    } catch (error) {
      console.error('Failed to clear transcription records:', error);
    }
  }

  /**
   * Get storage statistics
   */
  static getStorageStats(): {
    recordCount: number;
    sizeBytes: number;
    sizeMB: number;
    percentUsed: number;
    isNearLimit: boolean;
  } {
    const records = this.getTranscriptions();
    const sizeBytes = this.calculateStorageSize();
    const sizeMB = sizeBytes / (1024 * 1024);
    const percentUsed = (sizeBytes / MAX_STORAGE_SIZE_BYTES) * 100;
    const isNearLimit = percentUsed > 80 || records.length > MAX_RECORDS * 0.8;

    return {
      recordCount: records.length,
      sizeBytes,
      sizeMB,
      percentUsed,
      isNearLimit
    };
  }

  /**
   * Calculate total storage size used by transcription records
   */
  private static calculateStorageSize(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Blob([stored]).size : 0;
    } catch (error) {
      console.error('Failed to calculate storage size:', error);
      return 0;
    }
  }

  /**
   * Calculate size of specific records array
   */
  private static calculateRecordsSize(records: TranscriptionRecord[]): number {
    try {
      return new Blob([JSON.stringify(records)]).size;
    } catch (error) {
      console.error('Failed to calculate records size:', error);
      return 0;
    }
  }

  /**
   * Update storage settings
   */
  private static updateStorageSettings(): void {
    try {
      const records = this.getTranscriptions();
      const settings: StorageSettings = {
        lastCleanup: Date.now(),
        totalRecords: records.length,
        estimatedSize: this.calculateStorageSize()
      };
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to update storage settings:', error);
    }
  }

  /**
   * Get storage settings
   */
  static getStorageSettings(): StorageSettings | null {
    try {
      const stored = localStorage.getItem(STORAGE_SETTINGS_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to get storage settings:', error);
      return null;
    }
  }
}