-- Exam Attempts: one row per exam submission
CREATE TABLE exam_attempts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_score INT NOT NULL,
  total_questions INT NOT NULL,
  correct_answers INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT score_range CHECK (overall_score >= 0 AND overall_score <= 100)
);

-- Exam Answers: per question in an exam attempt
CREATE TABLE exam_answers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  exam_attempt_id BIGINT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id INT NOT NULL,
  user_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transcript Analyses: per transcript submission
CREATE TABLE transcript_analyses (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_text TEXT NOT NULL,
  competency_scores JSONB, -- Store the competency scores from Claude
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Chat Sessions: per coaching bot session
CREATE TABLE chat_sessions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Chat Messages: per message in a session
CREATE TABLE chat_messages (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  chat_session_id BIGINT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  message_order INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat Analyses: feedback/analysis after a chat session
CREATE TABLE chat_analyses (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  chat_session_id BIGINT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  analysis_text TEXT NOT NULL,
  competency_scores JSONB, -- Store the competency scores from Claude
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_exam_attempts_user_id ON exam_attempts(user_id);
CREATE INDEX idx_exam_attempts_created_at ON exam_attempts(created_at DESC);
CREATE INDEX idx_exam_answers_exam_attempt_id ON exam_answers(exam_attempt_id);
CREATE INDEX idx_transcript_analyses_user_id ON transcript_analyses(user_id);
CREATE INDEX idx_transcript_analyses_created_at ON transcript_analyses(created_at DESC);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(chat_session_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_analyses ENABLE ROW LEVEL SECURITY;

-- exam_attempts: coaches see only their own, admins see all
CREATE POLICY "coaches_can_see_own_exam_attempts" ON exam_attempts
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "coaches_can_insert_own_exam_attempts" ON exam_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coaches_can_delete_own_exam_attempts" ON exam_attempts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- exam_answers: coaches see only answers from their attempts, admins see all
CREATE POLICY "coaches_can_see_own_exam_answers" ON exam_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exam_attempts
      WHERE exam_attempts.id = exam_answers.exam_attempt_id
      AND (exam_attempts.user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "coaches_can_insert_own_exam_answers" ON exam_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_attempts
      WHERE exam_attempts.id = exam_attempt_id
      AND user_id = auth.uid()
    )
  );

-- transcript_analyses: coaches see only their own, admins see all
CREATE POLICY "coaches_can_see_own_transcript_analyses" ON transcript_analyses
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "coaches_can_insert_own_transcript_analyses" ON transcript_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coaches_can_delete_own_transcript_analyses" ON transcript_analyses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- chat_sessions: coaches see only their own, admins see all
CREATE POLICY "coaches_can_see_own_chat_sessions" ON chat_sessions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "coaches_can_insert_own_chat_sessions" ON chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coaches_can_delete_own_chat_sessions" ON chat_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- chat_messages: coaches see only messages from their sessions, admins see all
CREATE POLICY "coaches_can_see_own_chat_messages" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.chat_session_id
      AND (chat_sessions.user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "coaches_can_insert_own_chat_messages" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_session_id
      AND user_id = auth.uid()
    )
  );

-- chat_analyses: coaches see only analyses from their sessions, admins see all
CREATE POLICY "coaches_can_see_own_chat_analyses" ON chat_analyses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_analyses.chat_session_id
      AND (chat_sessions.user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "coaches_can_insert_own_chat_analyses" ON chat_analyses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_session_id
      AND user_id = auth.uid()
    )
  );
