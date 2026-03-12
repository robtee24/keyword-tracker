-- AI Credits system: balance tracking and transaction log

CREATE TABLE IF NOT EXISTS ai_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT -1, -- -1 = unlimited
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL, -- negative for usage, positive for purchase/refund
  balance_after NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('usage', 'purchase', 'refund', 'grant')),
  description TEXT,
  model_id TEXT,
  project_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_credit_transactions_user ON ai_credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_ai_credit_transactions_project ON ai_credit_transactions(project_id, created_at DESC);

ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits" ON ai_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages credits" ON ai_credits FOR ALL USING (true);

CREATE POLICY "Users can view own transactions" ON ai_credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages transactions" ON ai_credit_transactions FOR ALL USING (true);
