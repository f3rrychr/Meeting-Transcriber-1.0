// Audio segmentation utilities for parallel transcription processing

export interface AudioSegment {
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  blob: Blob;
  overlapStart: number;
  overlapEnd: number;
}

export interface SegmentationOptions {
  segmentDuration?: number; // seconds, default 900 (15 minutes)
  overlapDuration?: number; // seconds, default 2
  maxConcurrentSegments?: number; // default 3
  onProgress?: (segmentIndex: number, totalSegments: number, message: string) => void;
}

export interface TranscriptionSegment {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
  segments: Array<{
    text: string;
    timestamp: string;
    duration: number;
    absoluteStart: number; // Absolute time in the full audio
  }>;
  confidence?: number;
}

export class AudioSegmentationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AudioSegmentationError';
  }
}

/**
 * Split audio file into overlapping segments for parallel transcription
 */
export const segmentAudioFile = async (
  file: File,
  options: SegmentationOptions = {}
): Promise<AudioSegment[]> => {
  const {
    segmentDuration = 900, // 15 minutes
    overlapDuration = 2,   // 2 seconds
    onProgress
  } = options;

  console.log(`Segmenting audio file: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`);
  
  try {
    // Get audio duration using Web Audio API
    const audioDuration = await getAudioDuration(file);
    console.log(`Audio duration: ${Math.round(audioDuration)}s (${Math.round(audioDuration / 60)}min)`);
    
    // Calculate number of segments needed
    const totalSegments = Math.ceil(audioDuration / segmentDuration);
    console.log(`Creating ${totalSegments} segments of ${segmentDuration}s each with ${overlapDuration}s overlap`);
    
    if (totalSegments === 1) {
      // No segmentation needed for short files
      return [{
        index: 0,
        startTime: 0,
        endTime: audioDuration,
        duration: audioDuration,
        blob: file,
        overlapStart: 0,
        overlapEnd: 0
      }];
    }
    
    const segments: AudioSegment[] = [];
    
    // Create segments with overlap
    for (let i = 0; i < totalSegments; i++) {
      const startTime = Math.max(0, i * segmentDuration - (i > 0 ? overlapDuration : 0));
      const endTime = Math.min(audioDuration, (i + 1) * segmentDuration + (i < totalSegments - 1 ? overlapDuration : 0));
      const duration = endTime - startTime;
      
      onProgress?.(i + 1, totalSegments, `Creating segment ${i + 1}/${totalSegments}...`);
      
      // Extract audio segment using Web Audio API
      const segmentBlob = await extractAudioSegment(file, startTime, endTime);
      
      const segment: AudioSegment = {
        index: i,
        startTime: i * segmentDuration, // Actual start time without overlap
        endTime: Math.min(audioDuration, (i + 1) * segmentDuration), // Actual end time without overlap
        duration,
        blob: segmentBlob,
        overlapStart: i > 0 ? overlapDuration : 0,
        overlapEnd: i < totalSegments - 1 ? overlapDuration : 0
      };
      
      segments.push(segment);
      console.log(`Segment ${i}: ${startTime}s - ${endTime}s (${Math.round(duration)}s, ${Math.round(segmentBlob.size / 1024)}KB)`);
    }
    
    return segments;
    
  } catch (error) {
    console.error('Audio segmentation failed:', error);
    throw new AudioSegmentationError(`Failed to segment audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Get audio duration using Web Audio API
 */
const getAudioDuration = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    
    audio.addEventListener('error', (e) => {
      reject(new Error(`Failed to load audio metadata: ${e.message || 'Unknown error'}`));
    });
    
    // Create object URL for the file
    const url = URL.createObjectURL(file);
    audio.src = url;
    
    // Clean up after getting duration
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
    });
  });
};

/**
 * Extract audio segment using Web Audio API
 */
const extractAudioSegment = async (file: File, startTime: number, endTime: number): Promise<Blob> => {
  try {
    // For now, we'll use a simpler approach by creating a new blob with the same data
    // In a production environment, you'd want to use FFmpeg.wasm or Web Audio API
    // to actually extract the audio segment
    
    // This is a placeholder implementation - in reality, you'd need to:
    // 1. Decode the audio file
    // 2. Extract the specific time range
    // 3. Re-encode as a new audio file
    
    // For demonstration, we'll return the original file
    // TODO: Implement actual audio segment extraction
    console.warn('Audio segment extraction not fully implemented - using full file');
    return file;
    
  } catch (error) {
    throw new AudioSegmentationError(`Failed to extract audio segment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Stitch transcription segments back together by removing overlaps
 */
export const stitchTranscriptionSegments = (
  segments: TranscriptionSegment[],
  originalFileName: string
): {
  speakers: Array<{
    id: string;
    segments: Array<{
      text: string;
      timestamp: string;
      duration: number;
    }>;
  }>;
  meetingDate: string;
  meetingTitle: string;
  duration: string;
  wordCount: number;
} => {
  console.log(`Stitching ${segments.length} transcription segments`);
  
  // Sort segments by index to ensure correct order
  const sortedSegments = segments.sort((a, b) => a.index - b.index);
  
  const allSegments: Array<{
    text: string;
    timestamp: string;
    duration: number;
    absoluteStart: number;
  }> = [];
  
  // Process each segment and handle overlaps
  sortedSegments.forEach((segment, segmentIndex) => {
    console.log(`Processing segment ${segmentIndex}: ${segment.segments.length} text segments`);
    
    segment.segments.forEach((textSegment) => {
      // Skip overlapping content from previous segments
      if (segmentIndex > 0) {
        const previousSegment = sortedSegments[segmentIndex - 1];
        const overlapThreshold = previousSegment.endTime - 1; // 1 second buffer
        
        if (textSegment.absoluteStart < overlapThreshold) {
          console.log(`Skipping overlapping segment at ${textSegment.absoluteStart}s`);
          return; // Skip this overlapping segment
        }
      }
      
      allSegments.push(textSegment);
    });
  });
  
  // Remove duplicate content based on text similarity and timing
  const deduplicatedSegments = removeDuplicateSegments(allSegments);
  
  console.log(`Stitched segments: ${segments.length} → ${allSegments.length} → ${deduplicatedSegments.length} (after deduplication)`);
  
  // Create single speaker for now (speaker diarization would be separate)
  const speakers = [{
    id: 'Speaker_1',
    segments: deduplicatedSegments.map(seg => ({
      text: seg.text,
      timestamp: seg.timestamp,
      duration: seg.duration
    }))
  }];
  
  // Calculate total duration and word count
  const totalDuration = sortedSegments.length > 0 
    ? sortedSegments[sortedSegments.length - 1].endTime 
    : 0;
  
  const wordCount = deduplicatedSegments.reduce((count, seg) => 
    count + seg.text.split(' ').length, 0
  );
  
  return {
    speakers,
    meetingDate: new Date().toLocaleDateString(),
    meetingTitle: originalFileName.replace(/\.[^/.]+$/, "") + " (Segmented Transcription)",
    duration: formatDuration(totalDuration),
    wordCount
  };
};

/**
 * Remove duplicate segments based on text similarity and timing
 */
const removeDuplicateSegments = (segments: Array<{
  text: string;
  timestamp: string;
  duration: number;
  absoluteStart: number;
}>): Array<{
  text: string;
  timestamp: string;
  duration: number;
  absoluteStart: number;
}> => {
  const deduplicated: typeof segments = [];
  
  segments.forEach((segment, index) => {
    // Check if this segment is too similar to the previous one
    if (index > 0) {
      const prevSegment = segments[index - 1];
      const timeDiff = Math.abs(segment.absoluteStart - prevSegment.absoluteStart);
      const textSimilarity = calculateTextSimilarity(segment.text, prevSegment.text);
      
      // Skip if segments are very close in time and very similar in text
      if (timeDiff < 3 && textSimilarity > 0.8) {
        console.log(`Removing duplicate segment: "${segment.text.substring(0, 50)}..."`);
        return;
      }
    }
    
    deduplicated.push(segment);
  });
  
  return deduplicated;
};

/**
 * Calculate text similarity between two strings (simple implementation)
 */
const calculateTextSimilarity = (text1: string, text2: string): number => {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = Math.max(words1.length, words2.length);
  
  return totalWords > 0 ? commonWords.length / totalWords : 0;
};

/**
 * Format duration in HH:MM:SS format
 */
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format timestamp in MM:SS or HH:MM:SS format
 */
export const formatTimestamp = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};