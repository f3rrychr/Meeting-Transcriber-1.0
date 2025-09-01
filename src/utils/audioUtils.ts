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
   * Compress audio file to meet OpenAI's 25MB limit
   */
  static async compressAudio(file: File, onProgress?: (progress: number) => void): Promise<File> {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fileReader = new FileReader();

      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          
          // Decode audio data
          onProgress?.(20);
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Calculate compression parameters
          const originalDuration = audioBuffer.duration;
          const originalSampleRate = audioBuffer.sampleRate;
          const targetSampleRate = Math.min(22050, originalSampleRate); // Reduce sample rate if needed
          
          onProgress?.(40);
          
          // Create new audio buffer with reduced sample rate
          const compressedBuffer = audioContext.createBuffer(
            Math.min(audioBuffer.numberOfChannels, 1), // Convert to mono if stereo
            Math.floor(audioBuffer.length * (targetSampleRate / originalSampleRate)),
            targetSampleRate
          );

          // Copy and downsample audio data
          const sourceData = audioBuffer.getChannelData(0);
          const targetData = compressedBuffer.getChannelData(0);
          const ratio = sourceData.length / targetData.length;

          for (let i = 0; i < targetData.length; i++) {
            const sourceIndex = Math.floor(i * ratio);
            targetData[i] = sourceData[sourceIndex];
          }

          onProgress?.(60);

          // Convert to WAV format with lower quality
          const wavBlob = this.audioBufferToWav(compressedBuffer);
          
          onProgress?.(80);

          // Create new file
          const compressedFile = new File(
            [wavBlob], 
            file.name.replace(/\.[^/.]+$/, '_compressed.wav'),
            { type: 'audio/wav' }
          );

          onProgress?.(100);

          // Verify size reduction
          if (compressedFile.size > this.OPENAI_MAX_SIZE) {
            // If still too large, try more aggressive compression
            const furtherCompressed = await this.aggressiveCompress(compressedFile);
            resolve(furtherCompressed);
          } else {
            resolve(compressedFile);
          }

        } catch (error) {
          reject(new Error(`Audio compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };

      fileReader.onerror = () => {
        reject(new Error('Failed to read audio file for compression'));
      };

      fileReader.readAsArrayBuffer(file);
    });
  }

  /**
   * Convert AudioBuffer to WAV blob
   */
  private static audioBufferToWav(buffer: AudioBuffer): Blob {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * More aggressive compression if needed
   */
  private static async aggressiveCompress(file: File): Promise<File> {
    // This is a fallback - in a real implementation, you might use
    // a more sophisticated compression library or service
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Simple approach: take every other sample (crude downsampling)
    const compressed = new Uint8Array(Math.floor(uint8Array.length / 2));
    for (let i = 0; i < compressed.length; i++) {
      compressed[i] = uint8Array[i * 2];
    }
    
    return new File(
      [compressed], 
      file.name.replace(/\.[^/.]+$/, '_highly_compressed.wav'),
      { type: 'audio/wav' }
    );
  }

  /**
   * Get estimated compression ratio
   */
  static getEstimatedCompressionRatio(file: File): number {
    const ratio = this.OPENAI_MAX_SIZE / file.size;
    return Math.min(ratio * 0.8, 1); // 80% of theoretical ratio for safety
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