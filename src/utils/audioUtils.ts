// Audio utility functions with ffmpeg.wasm compression
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { validateFileStream } from './streamUtils';

export interface CompressionProgress {
  stage: 'loading' | 'processing' | 'complete';
  percentage: number;
  message: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
}

export interface CompressionOptions {
  targetBitrate?: number; // kbps, default 80
  sampleRate?: number; // Hz, default 16000
  channels?: number; // default 1 (mono)
  onProgress?: (progress: CompressionProgress) => void;
}

export class AudioProcessor {
  private static readonly OPENAI_MAX_SIZE = 500 * 1024 * 1024; // 500MB in bytes
  private static readonly COMPRESSION_THRESHOLD = 50 * 1024 * 1024; // 50MB threshold for compression
  private static ffmpegInstance: FFmpeg | null = null;
  private static isFFmpegLoaded = false;

  /**
   * Check if file needs processing for OpenAI API
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
    
    // Check if file would benefit from compression (large files)
    if (file.size > this.COMPRESSION_THRESHOLD) {
      return {
        needsProcessing: true,
        reason: `File size (${Math.round(file.size / 1024 / 1024)}MB) is large and would benefit from compression`
      };
    }
    
    return { needsProcessing: false };
  }

  /**
   * Initialize FFmpeg instance
   */
  private static async initializeFFmpeg(): Promise<FFmpeg> {
    if (this.ffmpegInstance && this.isFFmpegLoaded) {
      return this.ffmpegInstance;
    }

    console.log('Initializing FFmpeg...');
    const ffmpeg = new FFmpeg();
    
    // Load FFmpeg with progress tracking
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    this.ffmpegInstance = ffmpeg;
    this.isFFmpegLoaded = true;
    console.log('FFmpeg loaded successfully');
    
    return ffmpeg;
  }

  /**
   * Compress audio file using ffmpeg.wasm
   */
  static async compressAudio(
    file: File, 
    options: CompressionOptions = {}
  ): Promise<File> {
    const {
      targetBitrate = 80, // 80 kbps default (between 64-96 range)
      sampleRate = 16000, // 16kHz
      channels = 1, // mono
      onProgress
    } = options;

    console.log('Starting audio compression with ffmpeg.wasm:', {
      originalSize: this.formatFileSize(file.size),
      targetBitrate: `${targetBitrate}kbps`,
      sampleRate: `${sampleRate}Hz`,
      channels: channels === 1 ? 'mono' : 'stereo'
    });

    try {
      // Stage 1: Loading FFmpeg
      onProgress?.({
        stage: 'loading',
        percentage: 0,
        message: 'Loading FFmpeg WebAssembly...',
        originalSize: file.size
      });

      const ffmpeg = await this.initializeFFmpeg();

      onProgress?.({
        stage: 'loading',
        percentage: 50,
        message: 'FFmpeg loaded, preparing audio file...',
        originalSize: file.size
      });

      // Write input file to FFmpeg filesystem
      const inputFileName = `input.${this.getFileExtension(file.name)}`;
      const outputFileName = 'output.mp3';
      
      await ffmpeg.writeFile(inputFileName, await fetchFile(file));

      onProgress?.({
        stage: 'loading',
        percentage: 100,
        message: 'Audio file loaded, starting compression...',
        originalSize: file.size
      });

      // Stage 2: Processing
      onProgress?.({
        stage: 'processing',
        percentage: 0,
        message: 'Compressing audio to mono 16kHz...',
        originalSize: file.size
      });

      // Set up progress tracking for FFmpeg
      let processingProgress = 0;
      ffmpeg.on('progress', ({ progress }) => {
        processingProgress = Math.round(progress * 100);
        onProgress?.({
          stage: 'processing',
          percentage: processingProgress,
          message: `Compressing audio... ${processingProgress}%`,
          originalSize: file.size
        });
      });

      // FFmpeg command for audio compression
      // -i input: input file
      // -ac 1: mono (1 channel)
      // -ar 16000: 16kHz sample rate
      // -b:a 80k: 80kbps bitrate
      // -f mp3: MP3 format
      // -y: overwrite output file
      await ffmpeg.exec([
        '-i', inputFileName,
        '-ac', channels.toString(),
        '-ar', sampleRate.toString(),
        '-b:a', `${targetBitrate}k`,
        '-f', 'mp3',
        '-y',
        outputFileName
      ]);

      // Read compressed file
      const compressedData = await ffmpeg.readFile(outputFileName);
      const compressedBlob = new Blob([compressedData], { type: 'audio/mpeg' });
      
      // Calculate compression ratio
      const compressionRatio = file.size / compressedBlob.size;
      
      console.log('Compression completed:', {
        originalSize: this.formatFileSize(file.size),
        compressedSize: this.formatFileSize(compressedBlob.size),
        compressionRatio: `${compressionRatio.toFixed(2)}x`,
        spaceSaved: this.formatFileSize(file.size - compressedBlob.size)
      });

      // Stage 3: Complete
      onProgress?.({
        stage: 'complete',
        percentage: 100,
        message: 'Audio compression complete!',
        originalSize: file.size,
        compressedSize: compressedBlob.size,
        compressionRatio
      });

      // Create compressed file with appropriate name
      const compressedFileName = file.name.replace(/\.[^/.]+$/, '') + '_compressed.mp3';
      const compressedFile = new File([compressedBlob], compressedFileName, {
        type: 'audio/mpeg',
        lastModified: Date.now()
      });

      // Clean up FFmpeg filesystem
      try {
        await ffmpeg.deleteFile(inputFileName);
        await ffmpeg.deleteFile(outputFileName);
      } catch (cleanupError) {
        console.warn('Failed to clean up FFmpeg files:', cleanupError);
      }

      return compressedFile;

    } catch (error) {
      console.error('Audio compression failed:', error);
      
      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('SharedArrayBuffer')) {
          throw new Error('Audio compression requires SharedArrayBuffer support. Please ensure your browser supports this feature and the site is served over HTTPS.');
        } else if (error.message.includes('WebAssembly')) {
          throw new Error('Audio compression requires WebAssembly support. Please use a modern browser.');
        } else if (error.message.includes('network')) {
          throw new Error('Failed to load compression engine. Please check your internet connection.');
        }
      }
      
      throw new Error(`Audio compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
   * Get file extension from filename
   */
  private static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : 'audio';
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

  /**
   * Check if compression is needed (legacy method for backward compatibility)
   */
  static needsCompression(file: File): boolean {
    return file.size > this.COMPRESSION_THRESHOLD;
  }
}