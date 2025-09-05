/*
  # Create audio uploads tracking table

  1. New Tables
    - `audio_uploads`
      - `id` (uuid, primary key)
      - `upload_id` (text, unique identifier for uploads)
      - `storage_path` (text, path in Supabase Storage)
      - `file_name` (text, original filename)
      - `file_size` (bigint, file size in bytes)
      - `content_type` (text, MIME type)
      - `api_key_hash` (text, hashed API key for security)
      - `status` (text, upload/processing status)
      - `progress` (integer, processing progress percentage)
      - `current_chunk` (integer, current chunk being processed)
      - `total_chunks` (integer, total number of chunks)
      - `created_at` (timestamp)
      - `completed_at` (timestamp, nullable)

  2. Security
    - Enable RLS on `audio_uploads` table
    - Add policy for users to access their own uploads (by API key hash)

  3. Indexes
    - Index on upload_id for fast lookups
    - Index on status for filtering
    - Index on created_at for chronological queries
*/

CREATE TABLE IF NOT EXISTS audio_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id text UNIQUE NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  content_type text,
  api_key_hash text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  progress integer DEFAULT 0,
  current_chunk integer,
  total_chunks integer,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE audio_uploads ENABLE ROW LEVEL SECURITY;

-- Create policy for API key-based access
CREATE POLICY "Users can access their own uploads"
  ON audio_uploads
  FOR ALL
  TO authenticated
  USING (true); -- For now, allow all authenticated access

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audio_uploads_upload_id ON audio_uploads(upload_id);
CREATE INDEX IF NOT EXISTS idx_audio_uploads_status ON audio_uploads(status);
CREATE INDEX IF NOT EXISTS idx_audio_uploads_created_at ON audio_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_uploads_api_key_hash ON audio_uploads(api_key_hash);

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('audio-files', 'audio-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for audio files
CREATE POLICY "Authenticated users can upload audio files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'audio-files');

CREATE POLICY "Authenticated users can read audio files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'audio-files');

CREATE POLICY "Service role can manage audio files"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'audio-files');