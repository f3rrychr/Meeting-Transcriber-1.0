/*
  # Add resumable upload support to audio_uploads table

  1. New Columns
    - `compressed_path` (text) - Path to compressed version of the file
    - `compressed_size` (bigint) - Size of compressed file in bytes
    - `compression_ratio` (numeric) - Compression ratio (original/compressed)
    - `user_folder` (text) - User-specific folder for file organization
    - `upload_type` (text) - Type of upload (standard, resumable, chunked)
    - `resume_token` (text) - Token for resuming interrupted uploads
    - `upload_metadata` (jsonb) - Additional metadata for upload tracking

  2. Indexes
    - Add index on user_folder for efficient user file queries
    - Add index on upload_type for filtering upload methods
    - Add index on resume_token for resumable upload lookups

  3. Security
    - Update RLS policies to include new fields
*/

-- Add new columns for resumable upload support
DO $$
BEGIN
  -- Add compressed_path column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_uploads' AND column_name = 'compressed_path'
  ) THEN
    ALTER TABLE audio_uploads ADD COLUMN compressed_path text;
  END IF;

  -- Add compressed_size column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_uploads' AND column_name = 'compressed_size'
  ) THEN
    ALTER TABLE audio_uploads ADD COLUMN compressed_size bigint;
  END IF;

  -- Add compression_ratio column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_uploads' AND column_name = 'compression_ratio'
  ) THEN
    ALTER TABLE audio_uploads ADD COLUMN compression_ratio numeric(5,2);
  END IF;

  -- Add user_folder column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_uploads' AND column_name = 'user_folder'
  ) THEN
    ALTER TABLE audio_uploads ADD COLUMN user_folder text;
  END IF;

  -- Add upload_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_uploads' AND column_name = 'upload_type'
  ) THEN
    ALTER TABLE audio_uploads ADD COLUMN upload_type text DEFAULT 'standard';
  END IF;

  -- Add resume_token column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_uploads' AND column_name = 'resume_token'
  ) THEN
    ALTER TABLE audio_uploads ADD COLUMN resume_token text;
  END IF;

  -- Add upload_metadata column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_uploads' AND column_name = 'upload_metadata'
  ) THEN
    ALTER TABLE audio_uploads ADD COLUMN upload_metadata jsonb;
  END IF;
END $$;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audio_uploads_user_folder 
ON audio_uploads (user_folder);

CREATE INDEX IF NOT EXISTS idx_audio_uploads_upload_type 
ON audio_uploads (upload_type);

CREATE INDEX IF NOT EXISTS idx_audio_uploads_resume_token 
ON audio_uploads (resume_token) 
WHERE resume_token IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN audio_uploads.compressed_path IS 'Storage path for compressed version of the audio file';
COMMENT ON COLUMN audio_uploads.compressed_size IS 'Size of compressed file in bytes';
COMMENT ON COLUMN audio_uploads.compression_ratio IS 'Compression ratio (original size / compressed size)';
COMMENT ON COLUMN audio_uploads.user_folder IS 'User-specific folder for organizing files';
COMMENT ON COLUMN audio_uploads.upload_type IS 'Type of upload: standard, resumable, chunked';
COMMENT ON COLUMN audio_uploads.resume_token IS 'Token for resuming interrupted uploads';
COMMENT ON COLUMN audio_uploads.upload_metadata IS 'Additional metadata for upload tracking (JSON)';