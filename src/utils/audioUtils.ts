// Audio utility functions for compression and processing
import { validateFileStream } from './streamUtils';

export class AudioProcessor {
  private static readonly OPENAI_MAX_SIZE = 500 * 1024 * 1024; // 500MB in bytes
  private static readonly TARGET_BITRATE = 64000; // 64kbps for compression

  /**
   * Check if file needs processing for OpenAI API (without loading into memory)
   */
  static async needsProcessing(file: File): Promise<{ needsProcessing: boolean; reason?: string }> {
    // Use streaming validation instead of loading file
    const validation = await validateFileStream(file);
    
    if (!validation.isValid) {
      return { needsProcessing: false, reason: validation.error };
    }
    
    // Check if file is too large for direct processing
    if (file.size > this.OPENAI_MAX_SIZE) {
      return { 
        needsProcessing: true, 
        reason: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds OpenAI limit (${Math.round(this.OPENAI_MAX_SIZE / 1024 / 1024)}MB)` 
      };
    }
    
    return { needsProcessing: false };
  }

  /**
   * Validate file without loading into memory
   */
  static async validateFile(file: File): Promise<{ isValid: boolean; error?: string }> {
    const validation = await validateFileStream(file);
    return {
      isValid: validation.isValid,
      error: validation.error
    };
  }

  /**
   * Get file info without loading into memory
   */
  static getFileInfo(file: File): {
    name: string;
    size: number;
    sizeFormatted: string;
    type: string;
    lastModified: number;
  } {
    return {
      name: file.name,
      size: file.size,
      sizeFormatted: this.formatFileSize(file.size),
      type: file.type,
      lastModified: file.lastModified
    };
  }

  /**
   * Process large audio files using streaming (placeholder for future implementation)
   */
  static async processAudioStream(file: File, onProgress?: (progress: number) => void): Promise<File> {
    // For now, return the original file since we're using streaming upload
    console.log('Audio file will be processed via streaming upload:', file.name, 'Size:', this.formatFileSize(file.size));
    
    if (onProgress) {
      onProgress(100);
    }
    
    return file;
  }

  // Remove compression ratio method since we're not doing client-side compression

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}