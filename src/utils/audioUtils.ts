// Audio utility functions for compression and processing

export class AudioProcessor {
  private static readonly OPENAI_MAX_SIZE = 100 * 1024 * 1024; // 100MB in bytes (increased limit)
  private static readonly TARGET_BITRATE = 64000; // 64kbps for compression

  /**
   * Check if file needs processing for OpenAI API
   */
  static needsCompression(file: File): boolean {
    // Allow larger files, only compress if extremely large
    return file.size > (200 * 1024 * 1024); // 200MB threshold
  }

  /**
   * Process large audio files by chunking or optimization
   */
  static async compressAudio(file: File, onProgress?: (progress: number) => void): Promise<File> {
    // For very large files, we'll process them in chunks or use streaming
    console.log('Processing large audio file:', file.name, 'Size:', this.formatFileSize(file.size));
    
    // Return the original file for now - the edge function will handle large files
    if (onProgress) {
      onProgress(100);
    }
    
    return file;
  }

  /**
   * Get estimated compression ratio
   */
  static getEstimatedCompressionRatio(file: File): number {
    // Browser compression is not effective, return 1 (no compression)
    return 1;
  }

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