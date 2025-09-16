// File validation utilities with MIME sniffing and audio type detection
import { getFileSizeLimit, getDurationLimit } from './limits';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  detectedType?: string;
  suggestedFormat?: string;
  remediationTip?: string;
}

export interface AudioFileInfo {
  mimeType: string;
  extension: string;
  isSupported: boolean;
  displayName: string;
}

// Comprehensive audio format support matrix
const SUPPORTED_AUDIO_FORMATS: Record<string, AudioFileInfo> = {
  // Primary formats (best support)
  'audio/mpeg': { mimeType: 'audio/mpeg', extension: 'mp3', isSupported: true, displayName: 'MP3' },
  'audio/wav': { mimeType: 'audio/wav', extension: 'wav', isSupported: true, displayName: 'WAV' },
  'audio/wave': { mimeType: 'audio/wave', extension: 'wav', isSupported: true, displayName: 'WAV' },
  'audio/x-wav': { mimeType: 'audio/x-wav', extension: 'wav', isSupported: true, displayName: 'WAV' },
  
  // Secondary formats (good support)
  'audio/aac': { mimeType: 'audio/aac', extension: 'aac', isSupported: true, displayName: 'AAC' },
  'audio/mp4': { mimeType: 'audio/mp4', extension: 'm4a', isSupported: true, displayName: 'M4A' },
  'audio/x-m4a': { mimeType: 'audio/x-m4a', extension: 'm4a', isSupported: true, displayName: 'M4A' },
  'audio/ogg': { mimeType: 'audio/ogg', extension: 'ogg', isSupported: true, displayName: 'OGG' },
  'audio/webm': { mimeType: 'audio/webm', extension: 'webm', isSupported: true, displayName: 'WebM' },
  
  // Additional formats
  'audio/flac': { mimeType: 'audio/flac', extension: 'flac', isSupported: true, displayName: 'FLAC' },
  'audio/x-flac': { mimeType: 'audio/x-flac', extension: 'flac', isSupported: true, displayName: 'FLAC' },
};

// File extension to MIME type mapping for fallback detection
const EXTENSION_TO_MIME: Record<string, string> = {
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'aac': 'audio/aac',
  'm4a': 'audio/mp4',
  'ogg': 'audio/ogg',
  'webm': 'audio/webm',
  'flac': 'audio/flac',
};

// Magic number signatures for audio file detection
const AUDIO_SIGNATURES: Array<{ signature: number[]; mimeType: string; offset: number }> = [
  // MP3 - ID3v2 header
  { signature: [0x49, 0x44, 0x33], mimeType: 'audio/mpeg', offset: 0 },
  // MP3 - MPEG frame sync
  { signature: [0xFF, 0xFB], mimeType: 'audio/mpeg', offset: 0 },
  { signature: [0xFF, 0xF3], mimeType: 'audio/mpeg', offset: 0 },
  { signature: [0xFF, 0xF2], mimeType: 'audio/mpeg', offset: 0 },
  
  // WAV - RIFF header
  { signature: [0x52, 0x49, 0x46, 0x46], mimeType: 'audio/wav', offset: 0 },
  
  // AAC - ADTS header
  { signature: [0xFF, 0xF1], mimeType: 'audio/aac', offset: 0 },
  { signature: [0xFF, 0xF9], mimeType: 'audio/aac', offset: 0 },
  
  // M4A - ftyp box
  { signature: [0x66, 0x74, 0x79, 0x70], mimeType: 'audio/mp4', offset: 4 },
  
  // OGG - OggS header
  { signature: [0x4F, 0x67, 0x67, 0x53], mimeType: 'audio/ogg', offset: 0 },
  
  // FLAC - fLaC header
  { signature: [0x66, 0x4C, 0x61, 0x43], mimeType: 'audio/flac', offset: 0 },
];

/**
 * Advanced MIME type detection using magic numbers
 */
const detectMimeTypeFromContent = async (file: File): Promise<string | null> => {
  try {
    // Read first 64 bytes for signature detection (streaming approach)
    const headerSlice = file.slice(0, 64);
    const buffer = await headerSlice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Check against known audio signatures
    for (const { signature, mimeType, offset } of AUDIO_SIGNATURES) {
      if (bytes.length >= offset + signature.length) {
        const match = signature.every((byte, index) => bytes[offset + index] === byte);
        if (match) {
          console.log(`Detected ${mimeType} via magic number signature`);
          return mimeType;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to detect MIME type from content:', error);
    return null;
  }
};

/**
 * Get file extension from filename
 */
const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : '';
};

/**
 * Generate remediation tips for unsupported formats
 */
const generateRemediationTip = (detectedType: string, extension: string): string => {
  const commonFormats = ['MP3', 'WAV', 'AAC', 'M4A'];
  
  if (detectedType.includes('video')) {
    return `This appears to be a video file. Extract the audio track and save as ${commonFormats.join(', ')}.`;
  }
  
  if (extension === 'wma') {
    return 'WMA format is not supported. Convert to MP3 or WAV using audio conversion software.';
  }
  
  if (extension === 'amr') {
    return 'AMR format has limited support. Convert to WAV or MP3 for better compatibility.';
  }
  
  if (extension === 'ra' || extension === 'ram') {
    return 'RealAudio format is not supported. Convert to MP3 or WAV.';
  }
  
  return `Format not recognized. For best results, convert to ${commonFormats.slice(0, 2).join(' or ')} using audio conversion software.`;
};

/**
 * Comprehensive file validation with MIME sniffing
 */
export const validateAudioFile = async (file: File): Promise<FileValidationResult> => {
  const maxSize = getFileSizeLimit();
  const extension = getFileExtension(file.name);
  
  console.log('Validating file:', {
    name: file.name,
    size: file.size,
    browserMimeType: file.type,
    extension: extension
  });
  
  // Check file size first
  if (file.size > maxSize) {
    const limitMB = Math.round(maxSize / 1024 / 1024);
    const fileMB = Math.round(file.size / 1024 / 1024);
    return {
      isValid: false,
      error: `File size (${fileMB}MB) exceeds ${limitMB}MB limit. Please use a smaller audio file.`,
      remediationTip: 'Try compressing the audio file or splitting it into smaller segments.'
    };
  }
  
  if (file.size === 0) {
    return {
      isValid: false,
      error: 'File appears to be empty or corrupted.',
      remediationTip: 'Please select a valid audio file.'
    };
  }
  
  // Step 1: Check browser-reported MIME type
  let detectedMimeType = file.type;
  let validationMethod = 'browser';
  
  // Step 2: If browser MIME type is missing or generic, try content detection
  if (!detectedMimeType || detectedMimeType === 'application/octet-stream' || detectedMimeType === '') {
    console.log('Browser MIME type missing or generic, attempting content detection...');
    const contentMimeType = await detectMimeTypeFromContent(file);
    if (contentMimeType) {
      detectedMimeType = contentMimeType;
      validationMethod = 'content-sniffing';
    }
  }
  
  // Step 3: Fallback to extension-based detection
  if (!detectedMimeType && extension && EXTENSION_TO_MIME[extension]) {
    detectedMimeType = EXTENSION_TO_MIME[extension];
    validationMethod = 'extension';
    console.log(`Using extension-based detection: ${extension} -> ${detectedMimeType}`);
  }
  
  console.log(`MIME type detection result: ${detectedMimeType} (method: ${validationMethod})`);
  
  // Step 4: Validate against supported formats
  if (detectedMimeType && SUPPORTED_AUDIO_FORMATS[detectedMimeType]) {
    const formatInfo = SUPPORTED_AUDIO_FORMATS[detectedMimeType];
    
    // Check for extension mismatch warning
    if (extension && extension !== formatInfo.extension) {
      console.warn(`Extension mismatch: file has .${extension} but detected as ${formatInfo.displayName}`);
    }
    
    return {
      isValid: true,
      detectedType: formatInfo.displayName,
    };
  }
  
  // Step 5: Handle unsupported formats
  const displayType = detectedMimeType || `${extension.toUpperCase()} file` || 'Unknown format';
  const suggestedFormat = 'MP3';
  
  return {
    isValid: false,
    error: `Unsupported audio format: ${displayType}`,
    detectedType: displayType,
    suggestedFormat: suggestedFormat,
    remediationTip: generateRemediationTip(detectedMimeType || '', extension)
  };
};

/**
 * Get list of supported audio formats for display
 */
export const getSupportedFormats = (): string[] => {
  return Object.values(SUPPORTED_AUDIO_FORMATS)
    .map(format => format.displayName)
    .filter((name, index, array) => array.indexOf(name) === index) // Remove duplicates
    .sort();
};

/**
 * Get file accept string for input elements
 */
export const getFileAcceptString = (): string => {
  const extensions = Object.values(SUPPORTED_AUDIO_FORMATS)
    .map(format => `.${format.extension}`)
    .filter((ext, index, array) => array.indexOf(ext) === index); // Remove duplicates
  
  const mimeTypes = Object.keys(SUPPORTED_AUDIO_FORMATS);
  
  return [...mimeTypes, ...extensions].join(',');
};