// Segmented transcription service for parallel processing of long audio files
import { TranscriptData } from '../types';
import { transcribeAudioViaEdgeFunction } from './edgeFunctionService';
import { 
  segmentAudioFile, 
  stitchTranscriptionSegments, 
  AudioSegment, 
  TranscriptionSegment,
  SegmentationOptions,
  AudioSegmentationError,
  formatTimestamp
} from '../utils/audioSegmentation';

export interface SegmentedTranscriptionOptions extends SegmentationOptions {
  apiKey: string;
  onSegmentProgress?: (segmentIndex: number, totalSegments: number, progress: number) => void;
  onSegmentComplete?: (segmentIndex: number, totalSegments: number, result: TranscriptionSegment) => void;
  onOverallProgress?: (progress: {
    stage: 'segmenting' | 'transcribing' | 'stitching' | 'complete';
    percentage: number;
    message: string;
    completedSegments?: number;
    totalSegments?: number;
  }) => void;
}

export class SegmentedTranscriptionError extends Error {
  constructor(message: string, public code?: string, public segmentIndex?: number) {
    super(message);
    this.name = 'SegmentedTranscriptionError';
  }
}

/**
 * Transcribe long audio files using segmentation and parallel processing
 */
export const transcribeAudioSegmented = async (
  file: File,
  options: SegmentedTranscriptionOptions
): Promise<TranscriptData> => {
  const {
    apiKey,
    segmentDuration = 900, // 15 minutes
    overlapDuration = 2,   // 2 seconds
    maxConcurrentSegments = 3,
    onSegmentProgress,
    onSegmentComplete,
    onOverallProgress
  } = options;

  console.log(`Starting segmented transcription for: ${file.name}`);
  
  try {
    // Stage 1: Segment the audio file
    onOverallProgress?.({
      stage: 'segmenting',
      percentage: 0,
      message: 'Analyzing audio and creating segments...'
    });

    const segments = await segmentAudioFile(file, {
      segmentDuration,
      overlapDuration,
      onProgress: (segmentIndex, totalSegments, message) => {
        const percentage = Math.round((segmentIndex / totalSegments) * 20); // 0-20%
        onOverallProgress?.({
          stage: 'segmenting',
          percentage,
          message,
          completedSegments: segmentIndex,
          totalSegments
        });
      }
    });

    console.log(`Created ${segments.length} audio segments`);

    // Stage 2: Transcribe segments in parallel
    onOverallProgress?.({
      stage: 'transcribing',
      percentage: 20,
      message: `Transcribing ${segments.length} segments in parallel...`,
      completedSegments: 0,
      totalSegments: segments.length
    });

    const transcriptionResults = await transcribeSegmentsInParallel(
      segments,
      apiKey,
      maxConcurrentSegments,
      {
        onSegmentProgress: (segmentIndex, progress) => {
          onSegmentProgress?.(segmentIndex, segments.length, progress);
        },
        onSegmentComplete: (segmentIndex, result) => {
          const completedSegments = segmentIndex + 1;
          const percentage = 20 + Math.round((completedSegments / segments.length) * 60); // 20-80%
          
          onOverallProgress?.({
            stage: 'transcribing',
            percentage,
            message: `Completed segment ${completedSegments}/${segments.length}`,
            completedSegments,
            totalSegments: segments.length
          });
          
          onSegmentComplete?.(segmentIndex, segments.length, result);
        }
      }
    );

    // Stage 3: Stitch segments back together
    onOverallProgress?.({
      stage: 'stitching',
      percentage: 80,
      message: 'Stitching segments and removing overlaps...'
    });

    const stitchedResult = stitchTranscriptionSegments(transcriptionResults, file.name);

    onOverallProgress?.({
      stage: 'complete',
      percentage: 100,
      message: 'Segmented transcription completed!',
      completedSegments: segments.length,
      totalSegments: segments.length
    });

    console.log(`Segmented transcription completed: ${stitchedResult.wordCount} words`);
    return stitchedResult as TranscriptData;

  } catch (error) {
    console.error('Segmented transcription failed:', error);
    
    if (error instanceof AudioSegmentationError) {
      throw new SegmentedTranscriptionError(`Segmentation failed: ${error.message}`, 'SEGMENTATION_ERROR');
    }
    
    throw new SegmentedTranscriptionError(
      `Segmented transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'TRANSCRIPTION_ERROR'
    );
  }
};

/**
 * Transcribe multiple audio segments in parallel with concurrency control
 */
const transcribeSegmentsInParallel = async (
  segments: AudioSegment[],
  apiKey: string,
  maxConcurrent: number,
  callbacks: {
    onSegmentProgress?: (segmentIndex: number, progress: number) => void;
    onSegmentComplete?: (segmentIndex: number, result: TranscriptionSegment) => void;
  }
): Promise<TranscriptionSegment[]> => {
  const results: TranscriptionSegment[] = new Array(segments.length);
  const errors: Array<{ index: number; error: Error }> = [];
  
  // Create a semaphore to limit concurrent transcriptions
  const semaphore = new Semaphore(maxConcurrent);
  
  // Create transcription promises for all segments
  const transcriptionPromises = segments.map(async (segment, index) => {
    return semaphore.acquire(async () => {
      try {
        console.log(`Starting transcription of segment ${index} (${Math.round(segment.duration)}s)`);
        
        // Create a temporary file for this segment
        const segmentFile = new File([segment.blob], `segment_${index}.audio`, {
          type: segment.blob.type || 'audio/mpeg'
        });
        
        // Transcribe the segment
        const transcriptData = await transcribeAudioViaEdgeFunction(
          segmentFile,
          apiKey,
          (progress) => {
            callbacks.onSegmentProgress?.(index, progress.percentage);
          }
        );
        
        // Convert to TranscriptionSegment format with absolute timestamps
        const transcriptionSegment: TranscriptionSegment = {
          index,
          startTime: segment.startTime,
          endTime: segment.endTime,
          text: transcriptData.speakers.map(s => s.segments.map(seg => seg.text).join(' ')).join(' '),
          segments: transcriptData.speakers.flatMap(speaker =>
            speaker.segments.map(seg => ({
              text: seg.text,
              timestamp: seg.timestamp,
              duration: seg.duration || 0,
              absoluteStart: segment.startTime + parseTimestamp(seg.timestamp)
            }))
          )
        };
        
        results[index] = transcriptionSegment;
        callbacks.onSegmentComplete?.(index, transcriptionSegment);
        
        console.log(`Completed transcription of segment ${index}: ${transcriptionSegment.text.substring(0, 100)}...`);
        
      } catch (error) {
        console.error(`Failed to transcribe segment ${index}:`, error);
        errors.push({ index, error: error instanceof Error ? error : new Error('Unknown error') });
      }
    });
  });
  
  // Wait for all transcriptions to complete
  await Promise.all(transcriptionPromises);
  
  // Check for errors
  if (errors.length > 0) {
    const errorMessage = `Failed to transcribe ${errors.length} segments: ${errors.map(e => `Segment ${e.index}: ${e.error.message}`).join(', ')}`;
    throw new SegmentedTranscriptionError(errorMessage, 'PARALLEL_TRANSCRIPTION_ERROR');
  }
  
  // Filter out any undefined results (shouldn't happen if no errors)
  const validResults = results.filter(result => result !== undefined);
  
  if (validResults.length !== segments.length) {
    throw new SegmentedTranscriptionError(`Expected ${segments.length} results, got ${validResults.length}`, 'INCOMPLETE_RESULTS');
  }
  
  return validResults;
};

/**
 * Simple semaphore implementation for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const tryAcquire = () => {
        if (this.permits > 0) {
          this.permits--;
          task()
            .then(resolve)
            .catch(reject)
            .finally(() => {
              this.permits++;
              if (this.waitQueue.length > 0) {
                const next = this.waitQueue.shift();
                next?.();
              }
            });
        } else {
          this.waitQueue.push(tryAcquire);
        }
      };
      
      tryAcquire();
    });
  }
}

/**
 * Parse timestamp string to seconds
 */
const parseTimestamp = (timestamp: string): number => {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]; // MM:SS
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
  }
  return 0;
};

/**
 * Check if file should use segmented transcription
 */
export const shouldUseSegmentedTranscription = (file: File): boolean => {
  // Use segmented transcription for files larger than 100MB or longer than 30 minutes
  const sizeThreshold = 100 * 1024 * 1024; // 100MB
  
  // For now, we'll use file size as a proxy for duration
  // In a real implementation, you'd want to check actual audio duration
  return file.size > sizeThreshold;
};