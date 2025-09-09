/*
  # Create action_items table

  1. New Tables
    - `action_items`
      - `id` (uuid, primary key)
      - `no` (integer, row index)
      - `meeting` (text, meeting title/code)
      - `action_item` (text, action description)
      - `pic` (text, person in charge)
      - `due_date` (date, optional due date)
      - `remarks` (text, optional remarks)
      - `status` (text, status with check constraint)
      - `created_at` (timestamptz, creation timestamp)
      - `updated_at` (timestamptz, last update timestamp)
      - `user_id` (uuid, foreign key to auth.users)

  2. Security
    - Enable RLS on `action_items` table
    - Add policies for authenticated users to manage their own action items

  3. Constraints
    - Status field constrained to: 'Closed', 'InProgress', 'Delay', or empty string
    - Default status is empty string
*/

CREATE TABLE IF NOT EXISTS action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "no" int,
  meeting text NOT NULL,
  action_item text NOT NULL,
  pic text,
  due_date date,
  remarks text,
  status text CHECK (status IN ('Closed','InProgress','Delay','')) DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can view their own action items"
  ON action_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own action items"
  ON action_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own action items"
  ON action_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own action items"
  ON action_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_action_items_user_id ON action_items(user_id);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items(meeting);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_due_date ON action_items(due_date);
CREATE INDEX IF NOT EXISTS idx_action_items_created_at ON action_items(created_at DESC);

-- Trigger for automatic updated_at
CREATE OR REPLACE FUNCTION update_action_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW
  EXECUTE FUNCTION update_action_items_updated_at();