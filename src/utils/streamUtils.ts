// Stream utilities for handling large file uploads without loading entire file into memory
import { getFileSizeLimit } from './limits';

export interface StreamChunk {
  data: Uint8Array;
  offset: number;
  size: number;
  isLast: boolean;
}

export interface StreamOptions {
  chunkSize?: number;
  onProgress?: (bytesRead: number, totalBytes: number) => void;
  onChunk?: (chunk: StreamChunk) => void;
  maxFileSize?: number;
}

export class StreamError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'StreamError';
  }
}

/**
 * Create a ReadableStream from a File without loading it entirely into memory
 */
export const createFileStream = (
  file: File, 
  options: StreamOptions = {}
): ReadableStream<Uint8Array> => {
  const {
    chunkSize = 1024 * 1024, // 1MB chunks by default
    onProgress,
    onChunk,
    maxFileSize = 500 * 1024 * 1024 // 500MB default limit
  } = options;

  // Size guard - check before streaming
  if (file.size > maxFileSize) {
    throw new StreamError(
      `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxFileSize / 1024 / 1024)}MB)`,
      'FILE_TOO_LARGE'
    );
  }

  let offset = 0;
  const totalSize = file.size;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      console.log(`Starting file stream for ${file.name} (${Math.round(totalSize / 1024 / 1024)}MB)`);
    },

    async pull(controller) {
      try {
        if (offset >= totalSize) {
          console.log('File stream complete');
          controller.close();
          return;
        }

        // Calculate chunk size for this iteration
        const currentChunkSize = Math.min(chunkSize, totalSize - offset);
        
        // Create a slice of the file (this doesn't load the data yet)
        const slice = file.slice(offset, offset + currentChunkSize);
        
        // Read only this chunk into memory
        const arrayBuffer = await slice.arrayBuffer();
        const chunk = new Uint8Array(arrayBuffer);
        
        // Create chunk info
        const chunkInfo: StreamChunk = {
          data: chunk,
          offset,
          size: currentChunkSize,
          isLast: offset + currentChunkSize >= totalSize
        };

        // Notify about chunk
        if (onChunk) {
          onChunk(chunkInfo);
        }

        // Update progress
        offset += currentChunkSize;
        if (onProgress) {
          onProgress(offset, totalSize);
        }

        // Enqueue the chunk
        controller.enqueue(chunk);

        console.log(`Streamed chunk: ${Math.round(offset / 1024 / 1024)}MB / ${Math.round(totalSize / 1024 / 1024)}MB`);

      } catch (error) {
        console.error('Error reading file chunk:', error);
        controller.error(new StreamError(`Failed to read file chunk: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    },

    cancel(reason) {
      console.log('File stream cancelled:', reason);
    }
  });
};

/**
 * Stream a file using XMLHttpRequest with progress tracking
 */
export const streamFileUpload = async (
  file: File,
  url: string,
  options: {
    headers?: Record<string, string>;
    onProgress?: (bytesUploaded: number, totalBytes: number) => void;
    onChunk?: (chunk: StreamChunk) => void;
    chunkSize?: number;
    maxFileSize?: number;
    timeout?: number;
  } = {}
): Promise<Response> => {
  const {
    headers = {},
    onProgress,
    onChunk,
    chunkSize = 1024 * 1024, // 1MB chunks
    maxFileSize = 500 * 1024 * 1024, // 500MB limit
    timeout = 600000 // 10 minutes
  } = options;

  // Size guard
  if (file.size > maxFileSize) {
    throw new StreamError(
      `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxFileSize / 1024 / 1024)}MB)`,
      'FILE_TOO_LARGE'
    );
  }

  console.log(`Starting streamed upload for ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded, event.total);
      }
    });
    
    // Handle completion
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Create a Response-like object
        const response = {
          ok: true,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: new Headers(),
          json: async () => JSON.parse(xhr.responseText),
          text: async () => xhr.responseText,
          blob: async () => new Blob([xhr.response])
        } as Response;
        
        resolve(response);
      } else {
        reject(new StreamError(`HTTP ${xhr.status}: ${xhr.statusText}`, 'HTTP_ERROR'));
      }
    });
    
    // Handle errors
    xhr.addEventListener('error', () => {
      reject(new StreamError('Network error during upload', 'NETWORK_ERROR'));
    });
    
    xhr.addEventListener('timeout', () => {
      reject(new StreamError('Upload timeout', 'TIMEOUT'));
    });
    
    // Configure request
    xhr.open('POST', url);
    xhr.timeout = timeout;
    
    // Set headers
    Object.entries(headers).forEach(([key, value]) => {
      if (key !== 'Content-Type') { // Let browser set Content-Type for FormData
        xhr.setRequestHeader(key, value);
      }
    });
    
    // Create FormData with the file (this doesn't load the entire file into memory)
    const formData = new FormData();
    formData.append('file', file);
    
    // Add other form fields if needed
    if (headers && 'apiKey' in headers) {
      formData.append('apiKey', headers.apiKey);
    }
    
    // Send the request
    xhr.send(formData);
  });
};

/**
 * Create a chunked upload stream for very large files
 */
export const createChunkedUploadStream = (
  file: File,
  options: StreamOptions = {}
): ReadableStream<FormData> => {
  const {
    chunkSize = 5 * 1024 * 1024, // 5MB chunks for chunked upload
    onProgress,
    onChunk,
    maxFileSize = 500 * 1024 * 1024
  } = options;

  // Size guard
  if (file.size > maxFileSize) {
    throw new StreamError(
      `File size exceeds maximum allowed size`,
      'FILE_TOO_LARGE'
    );
  }

  let offset = 0;
  const totalSize = file.size;
  let chunkIndex = 0;

  return new ReadableStream<FormData>({
    async pull(controller) {
      try {
        if (offset >= totalSize) {
          controller.close();
          return;
        }

        const currentChunkSize = Math.min(chunkSize, totalSize - offset);
        const slice = file.slice(offset, offset + currentChunkSize);
        
        // Read chunk into memory (only this chunk, not the whole file)
        const arrayBuffer = await slice.arrayBuffer();
        const chunkBlob = new Blob([arrayBuffer]);
        
        // Create FormData for this chunk
        const formData = new FormData();
        formData.append('chunk', chunkBlob);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', Math.ceil(totalSize / chunkSize).toString());
        formData.append('offset', offset.toString());
        formData.append('totalSize', totalSize.toString());
        formData.append('fileName', file.name);
        
        // Create chunk info
        const chunkInfo: StreamChunk = {
          data: new Uint8Array(arrayBuffer),
          offset,
          size: currentChunkSize,
          isLast: offset + currentChunkSize >= totalSize
        };

        if (onChunk) {
          onChunk(chunkInfo);
        }

        offset += currentChunkSize;
        chunkIndex++;

        if (onProgress) {
          onProgress(offset, totalSize);
        }

        controller.enqueue(formData);

      } catch (error) {
        controller.error(new StreamError(`Failed to create chunk: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }
  });
};

/**
 * Validate file without loading it into memory
 */
export const validateFileStream = async (file: File): Promise<{
  isValid: boolean;
  error?: string;
  fileInfo: {
    name: string;
    size: number;
    type: string;
    lastModified: number;
  };
}> => {
  const fileInfo = {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified
  };

  // Basic validation without reading file content
  if (file.size === 0) {
    return {
      isValid: false,
      error: 'File is empty',
      fileInfo
    };
  }

  if (file.size > 500 * 1024 * 1024) {
  }
  const fileSizeLimit = getFileSizeLimit();
  if (file.size > fileSizeLimit) {
    const limitMB = Math.round(fileSizeLimit / 1024 / 1024);
    const fileMB = Math.round(file.size / 1024 / 1024);
    return {
      isValid: false,
      error: `File too large (${fileMB}MB). Maximum size is ${limitMB}MB.`,
      fileInfo
    };
  }

  // For more detailed validation, we can read just the first few bytes
  try {
    const headerSlice = file.slice(0, 64);
    const headerBuffer = await headerSlice.arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer);
    
    // Basic magic number validation (without loading full file)
    const isLikelyAudio = 
      // MP3
      (headerBytes[0] === 0xFF && (headerBytes[1] & 0xE0) === 0xE0) ||
      (headerBytes[0] === 0x49 && headerBytes[1] === 0x44 && headerBytes[2] === 0x33) ||
      // WAV
      (headerBytes[0] === 0x52 && headerBytes[1] === 0x49 && headerBytes[2] === 0x46 && headerBytes[3] === 0x46) ||
      // OGG
      (headerBytes[0] === 0x4F && headerBytes[1] === 0x67 && headerBytes[2] === 0x67 && headerBytes[3] === 0x53) ||
      // M4A (check for ftyp box)
      (headerBytes[4] === 0x66 && headerBytes[5] === 0x74 && headerBytes[6] === 0x79 && headerBytes[7] === 0x70);

    if (!isLikelyAudio && !file.type.startsWith('audio/')) {
      return {
        isValid: false,
        error: 'File does not appear to be an audio file',
        fileInfo
      };
    }

    return {
      isValid: true,
      fileInfo
    };

  } catch (error) {
    return {
      isValid: false,
      error: `Failed to validate file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      fileInfo
    };
  }
};