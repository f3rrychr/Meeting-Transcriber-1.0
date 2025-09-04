// Audio utility functions for compression and processing

export class AudioProcessor {
  private static readonly OPENAI_MAX_SIZE = 25 * 1024 * 1024; // 25MB in bytes
  private static readonly TARGET_BITRATE = 64000; // 64kbps for compression

  /**
   * Check if file needs compression for OpenAI API
   */
  static needsCompression(file: File): boolean {
    return file.size > this.OPENAI_MAX_SIZE;
  }

  /**
   * Attempt basic audio optimization (note: limited compression capability in browser)
   */
  static async compressAudio(file: File, onProgress?: (progress: number) => void): Promise<File> {
    // Browser-based audio compression is limited and often increases file size
    // when converting to uncompressed formats like WAV
    throw new Error('Browser-based compression cannot reduce file size sufficiently. Please use an external tool to compress your audio file to under 25MB before uploading.');
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