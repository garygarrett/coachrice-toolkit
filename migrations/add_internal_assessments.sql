-- Internal Assessments: per internal assessor submission (2021 or 2025)
CREATE TABLE internal_assessments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessor_type TEXT NOT NULL CHECK (assessor_type IN ('2021', '2025')),
  transcript_filename TEXT,
  assessment_data JSONB NOT NULL, -- Full evaluation JSON from Claude
  competency_scores JSONB, -- Parsed competency averages
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_internal_assessments_user_id ON internal_assessments(user_id);
CREATE INDEX idx_internal_assessments_assessor_type ON internal_assessments(assessor_type);
CREATE INDEX idx_internal_assessments_created_at ON internal_assessments(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE internal_assessments ENABLE ROW LEVEL SECURITY;

-- internal_assessments: coaches see only their own, admins see all
CREATE POLICY "coaches_can_see_own_internal_assessments" ON internal_assessments
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "coaches_can_insert_own_internal_assessments" ON internal_assessments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coaches_can_delete_own_internal_assessments" ON internal_assessments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
