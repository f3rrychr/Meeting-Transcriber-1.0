// Centralized limits and constants for the application

// Get limits from environment variables with fallbacks
export const getFileSizeLimit = (): number => {
  const envLimit = import.meta.env.VITE_MAX_FILE_SIZE_MB;
  return envLimit ? parseInt(envLimit) * 1024 * 1024 : 500 * 1024 * 1024; // Default 500MB
};

export const getDurationLimit = (): number => {
  const envLimit = import.meta.env.VITE_MAX_DURATION_MINUTES;
  return envLimit ? parseInt(envLimit) : 180; // Default 180 minutes (3 hours)
};

export const getOpenAIChunkLimit = (): number => {
  const envLimit = import.meta.env.VITE_OPENAI_CHUNK_SIZE_MB;
  return envLimit ? parseInt(envLimit) * 1024 * 1024 : 25 * 1024 * 1024; // Default 25MB
};

// File size threshold for resumable uploads (50MB)
export const RESUMABLE_UPLOAD_THRESHOLD = 50 * 1024 * 1024;