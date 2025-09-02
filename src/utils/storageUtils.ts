import { TranscriptionRecord, TranscriptData, SummaryData } from '../types';

const STORAGE_KEY = 'meeting-transcriber-history';

export class TranscriptionStorage {
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
      
      // Keep only last 50 records to prevent localStorage bloat
      const trimmedRecords = records.slice(0, 50);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedRecords));
      console.log('Transcription record saved:', newRecord.title);
    } catch (error) {
      console.error('Failed to save transcription record:', error);
    }
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
   * Clear all transcription records
   */
  static clearAllTranscriptions(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('All transcription records cleared');
    } catch (error) {
      console.error('Failed to clear transcription records:', error);
    }
  }
}