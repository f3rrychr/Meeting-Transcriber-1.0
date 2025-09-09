// Resumable upload service using tus protocol for large audio files
import { createClient } from '@supabase/supabase-js';
import * as tus from 'tus-js-client';
import { AudioProcessor } from '../utils/audioUtils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// File size threshold for resumable uploads (50MB)
const RESUMABLE_UPLOAD_THRESHOLD = 50 * 1024 * 1024;

export interface ResumableUploadProgress {
  stage: 'preparing' | 'compressing' | 'uploading-original' | 'uploading-compressed' | 'complete';
  percentage: number;
  message: string;
  bytesUploaded?: number;
  totalBytes?: number;
  uploadSpeed?: number;
  estimatedTimeRemaining?: number;
  currentFile?: 'original' | 'compressed';
}

export interface ResumableUploadResult {
  originalPath: string;
  compressedPath?: string;
  originalSize: number;
  compressedSize?: number;
  compressionRatio?: number;
  uploadId: string;
  userFolder: string;
}

export interface ResumableUploadOptions {
  onProgress?: (progress: ResumableUploadProgress) => void;
  onError?: (error: Error) => void;
  chunkSize?: number; // Default 5MB chunks
  retryDelays?: number[]; // Retry delays in ms
  apiKey: string;
}

export class ResumableUploadService {
  private supabase: any;
  private userFolder: string;

  constructor(apiKey: string) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase configuration not found');
    }

    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // Create user folder based on API key hash (for privacy)
    this.userFolder = this.generateUserFolder(apiKey);
  }

  /**
   * Generate user folder name from API key hash
   */
  private generateUserFolder(apiKey: string): string {
    // Create a simple hash of the API key for folder naming
    let hash = 0;
    for (let i = 0; i < apiKey.length; i++) {
      const char = apiKey.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `user_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Check if file needs resumable upload
   */
  static needsResumableUpload(file: File): boolean {
    return file.size > RESUMABLE_UPLOAD_THRESHOLD;
  }

  /**
   * Upload audio file with resumable support
   */
  async uploadAudio(
    file: File,
    options: ResumableUploadOptions
  ): Promise<ResumableUploadResult> {
    const {
      onProgress,
      onError,
      chunkSize = 5 * 1024 * 1024, // 5MB chunks
      retryDelays = [1000, 3000, 5000], // 1s, 3s, 5s
      apiKey
    } = options;

    const uploadId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    try {
      // Stage 1: Preparation
      onProgress?.({
        stage: 'preparing',
        percentage: 0,
        message: 'Preparing files for upload...'
      });

      // Validate file
      const validation = await AudioProcessor.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error || 'File validation failed');
      }

      // Stage 2: Compression (if needed)
      let compressedFile: File | null = null;
      let compressionRatio: number | undefined;

      if (AudioProcessor.needsCompression(file)) {
        onProgress?.({
          stage: 'compressing',
          percentage: 10,
          message: 'Compressing audio for optimal upload...'
        });

        compressedFile = await AudioProcessor.compressAudio(file, {
          targetBitrate: 80,
          sampleRate: 16000,
          channels: 1,
          onProgress: (compressionProgress) => {
            onProgress?.({
              stage: 'compressing',
              percentage: 10 + (compressionProgress.percentage * 0.2), // 10-30%
              message: compressionProgress.message
            });
          }
        });

        compressionRatio = file.size / compressedFile.size;
      }

      // Stage 3: Upload original file
      const originalPath = await this.uploadFileWithTus(
        file,
        `${this.userFolder}/${timestamp}-${uploadId}-original.${this.getFileExtension(file.name)}`,
        {
          chunkSize,
          retryDelays,
          onProgress: (progress) => {
            onProgress?.({
              stage: 'uploading-original',
              percentage: 30 + (progress * 0.35), // 30-65%
              message: 'Uploading original file...',
              bytesUploaded: progress * file.size,
              totalBytes: file.size,
              currentFile: 'original'
            });
          }
        }
      );

      // Stage 4: Upload compressed file (if exists)
      let compressedPath: string | undefined;
      if (compressedFile) {
        compressedPath = await this.uploadFileWithTus(
          compressedFile,
          `${this.userFolder}/${timestamp}-${uploadId}-compressed.mp3`,
          {
            chunkSize,
            retryDelays,
            onProgress: (progress) => {
              onProgress?.({
                stage: 'uploading-compressed',
                percentage: 65 + (progress * 0.35), // 65-100%
                message: 'Uploading compressed file...',
                bytesUploaded: progress * compressedFile!.size,
                totalBytes: compressedFile!.size,
                currentFile: 'compressed'
              });
            }
          }
        );
      }

      // Stage 5: Complete
      onProgress?.({
        stage: 'complete',
        percentage: 100,
        message: 'Upload completed successfully!'
      });

      const result: ResumableUploadResult = {
        originalPath,
        compressedPath,
        originalSize: file.size,
        compressedSize: compressedFile?.size,
        compressionRatio,
        uploadId,
        userFolder: this.userFolder
      };

      // Store upload metadata
      await this.storeUploadMetadata(result, file.name, apiKey);

      return result;

    } catch (error) {
      console.error('Resumable upload failed:', error);
      onError?.(error instanceof Error ? error : new Error('Upload failed'));
      throw error;
    }
  }

  /**
   * Upload file using tus protocol for resumability
   */
  private uploadFileWithTus(
    file: File,
    storagePath: string,
    options: {
      chunkSize: number;
      retryDelays: number[];
      onProgress: (progress: number) => void;
    }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const { chunkSize, retryDelays, onProgress } = options;

      // Get upload URL for Supabase Storage
      const uploadUrl = `${SUPABASE_URL}/storage/v1/upload/resumable`;

      const upload = new tus.Upload(file, {
        endpoint: uploadUrl,
        retryDelays,
        chunkSize,
        metadata: {
          bucketName: 'audio-files',
          objectName: storagePath,
          contentType: file.type || 'audio/mpeg',
          cacheControl: '3600'
        },
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-upsert': 'true' // Allow overwriting
        },
        onError: (error) => {
          console.error('TUS upload error:', error);
          reject(new Error(`Upload failed: ${error.message}`));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const progress = bytesUploaded / bytesTotal;
          onProgress(progress);
        },
        onSuccess: () => {
          console.log('TUS upload completed:', storagePath);
          resolve(storagePath);
        }
      });

      // Start the upload
      upload.start();
    });
  }

  /**
   * Store upload metadata in database
   */
  private async storeUploadMetadata(
    result: ResumableUploadResult,
    originalFileName: string,
    apiKey: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('audio_uploads')
        .insert({
          upload_id: result.uploadId,
          storage_path: result.originalPath,
          compressed_path: result.compressedPath,
          file_name: originalFileName,
          file_size: result.originalSize,
          compressed_size: result.compressedSize,
          compression_ratio: result.compressionRatio,
          user_folder: result.userFolder,
          api_key_hash: await this.hashApiKey(apiKey),
          status: 'uploaded',
          upload_type: 'resumable',
          created_at: new Date().toISOString()
        });

      if (error) {
        console.warn('Failed to store upload metadata:', error);
      }
    } catch (error) {
      console.warn('Failed to store upload metadata:', error);
    }
  }

  /**
   * Hash API key for secure storage
   */
  private async hashApiKey(apiKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : 'audio';
  }

  /**
   * Resume interrupted upload
   */
  async resumeUpload(uploadId: string, file: File): Promise<ResumableUploadResult> {
    // Implementation for resuming interrupted uploads
    // This would query the database for existing upload metadata
    // and continue from where it left off
    throw new Error('Resume upload not yet implemented');
  }

  /**
   * Cancel ongoing upload
   */
  cancelUpload(uploadId: string): void {
    // Implementation for canceling uploads
    // This would abort the tus upload and clean up resources
    console.log('Canceling upload:', uploadId);
  }

  /**
   * Get upload progress for existing upload
   */
  async getUploadProgress(uploadId: string): Promise<ResumableUploadProgress | null> {
    // Implementation for checking upload progress
    // This would query the upload status from the server
    return null;
  }
}