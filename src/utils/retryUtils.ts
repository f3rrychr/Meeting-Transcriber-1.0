// Retry utilities with exponential backoff and jitter
export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitterFactor?: number;
  retryableStatusCodes?: number[];
  onRetry?: (attempt: number, delay: number, error: any) => void;
  onCountdown?: (remainingSeconds: number) => void;
}

export interface RetryError extends Error {
  statusCode?: number;
  retryAfter?: number;
  attempt?: number;
  maxRetries?: number;
}

export class RetryableError extends Error implements RetryError {
  constructor(
    message: string,
    public code: string = 'RETRYABLE_ERROR',
    public statusCode?: number,
    public retryAfter?: number,
    public attempt?: number,
    public maxRetries?: number
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

/**
 * Calculate exponential backoff delay with jitter
 */
export const calculateBackoffDelay = (
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
  jitterFactor: number = 0.1
): number => {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  
  // Add jitter to prevent thundering herd
  const jitter = exponentialDelay * jitterFactor * Math.random();
  
  return Math.floor(exponentialDelay + jitter);
};

/**
 * Parse Retry-After header value
 */
export const parseRetryAfter = (retryAfterHeader: string | null): number => {
  if (!retryAfterHeader) return 0;
  
  // Retry-After can be in seconds (number) or HTTP date
  const seconds = parseInt(retryAfterHeader, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000; // Convert to milliseconds
  }
  
  // Try parsing as HTTP date
  const date = new Date(retryAfterHeader);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }
  
  return 0;
};

/**
 * Sleep with countdown callback
 */
export const sleepWithCountdown = async (
  delayMs: number,
  onCountdown?: (remainingSeconds: number) => void
): Promise<void> => {
  if (!onCountdown) {
    return new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  const startTime = Date.now();
  const endTime = startTime + delayMs;
  
  return new Promise(resolve => {
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const remainingSeconds = Math.ceil(remaining / 1000);
      
      onCountdown(remainingSeconds);
      
      if (remaining <= 0) {
        resolve();
      } else {
        setTimeout(updateCountdown, 1000);
      }
    };
    
    updateCountdown();
  });
};

/**
 * Check if error is retryable
 */
export const isRetryableError = (
  error: any,
  retryableStatusCodes: number[] = [429, 500, 502, 503, 504]
): boolean => {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // Check status codes
  if (error.statusCode && retryableStatusCodes.includes(error.statusCode)) {
    return true;
  }
  
  // Check for specific error names
  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return false; // Don't retry timeouts/aborts
  }
  
  return false;
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    jitterFactor = 0.1,
    retryableStatusCodes = [429, 500, 502, 503, 504],
    onRetry,
    onCountdown
  } = options;
  
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Check if error is retryable
      if (!isRetryableError(error, retryableStatusCodes)) {
        break;
      }
      
      // Calculate delay
      let delay: number;
      
      // Respect Retry-After header if present
      if (error.retryAfter) {
        delay = error.retryAfter;
      } else {
        delay = calculateBackoffDelay(attempt, baseDelay, maxDelay, jitterFactor);
      }
      
      // Notify about retry
      if (onRetry) {
        onRetry(attempt + 1, delay, error);
      }
      
      // Wait with countdown
      await sleepWithCountdown(delay, onCountdown);
    }
  }
  
  // Enhance error with retry information
  if (lastError instanceof Error) {
    const retryError = new RetryableError(
      `Failed after ${maxRetries + 1} attempts: ${lastError.message}`,
      lastError.statusCode,
      lastError.retryAfter,
      maxRetries + 1,
      maxRetries
    );
    throw retryError;
  }
  
  throw lastError;
};