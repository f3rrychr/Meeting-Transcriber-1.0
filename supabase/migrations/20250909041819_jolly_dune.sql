/*
  # Create meetings and attachments tables for hybrid meeting support

  1. New Tables
    - `meetings`
      - `id` (uuid, primary key)
      - `title` (text)
      - `date` (timestamptz)
      - `participants` (jsonb array)
      - `notes` (text)
      - `attachments` (jsonb array of file references)
      - `is_online` (boolean)
      - `is_offline_recorded` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `version` (integer for conflict resolution)
    
    - `meeting_attachments`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key)
      - `name` (text)
      - `size` (bigint)
      - `type` (text)
      - `url` (text, storage path)
      - `uploaded_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `version` (integer)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own meetings
    - Add policies for meeting attachments based on meeting ownership

  3. Storage
    - Create storage bucket for meeting attachments
    - Set up appropriate policies for file access
*/

-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date timestamptz NOT NULL,
  participants jsonb DEFAULT '[]'::jsonb,
  notes text DEFAULT '',
  attachments jsonb DEFAULT '[]'::jsonb,
  is_online boolean DEFAULT false,
  is_offline_recorded boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  version integer DEFAULT 1,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create meeting_attachments table
CREATE TABLE IF NOT EXISTS meeting_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  name text NOT NULL,
  size bigint NOT NULL,
  type text NOT NULL,
  url text,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  version integer DEFAULT 1
);

-- Enable Row Level Security
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for meetings table
CREATE POLICY "Users can view their own meetings"
  ON meetings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meetings"
  ON meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meetings"
  ON meetings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meetings"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for meeting_attachments table
CREATE POLICY "Users can view attachments for their meetings"
  ON meeting_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_attachments.meeting_id 
      AND meetings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create attachments for their meetings"
  ON meeting_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_attachments.meeting_id 
      AND meetings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update attachments for their meetings"
  ON meeting_attachments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_attachments.meeting_id 
      AND meetings.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_attachments.meeting_id 
      AND meetings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments for their meetings"
  ON meeting_attachments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_attachments.meeting_id 
      AND meetings.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_updated_at ON meetings(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_attachments_meeting_id ON meeting_attachments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attachments_updated_at ON meeting_attachments(updated_at DESC);

-- Create storage bucket for meeting attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-attachments', 'meeting-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Users can upload meeting attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'meeting-attachments');

CREATE POLICY "Users can view their meeting attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'meeting-attachments');

CREATE POLICY "Users can update their meeting attachments"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'meeting-attachments');

CREATE POLICY "Users can delete their meeting attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'meeting-attachments');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_attachments_updated_at
  BEFORE UPDATE ON meeting_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();