import { getSupabase } from './db.js';

/**
 * Get AI credits balance for a user.
 * Returns { balance: number, unlimited: boolean }.
 * Creates a row with unlimited credits if none exists.
 */
export async function getCreditsBalance(userId) {
  const supabase = getSupabase();
  if (!supabase) return { balance: -1, unlimited: true };

  const { data, error } = await supabase
    .from('ai_credits')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Credits] Balance read error:', error.message);
    return { balance: -1, unlimited: true };
  }

  if (!data) {
    await supabase.from('ai_credits').insert({ user_id: userId, balance: -1 });
    return { balance: -1, unlimited: true };
  }

  return {
    balance: Number(data.balance),
    unlimited: Number(data.balance) === -1,
  };
}

/**
 * Deduct credits from a user's balance. Logs a transaction.
 * Skips deduction if balance is -1 (unlimited).
 * Returns { allowed: boolean, newBalance: number }.
 */
export async function deductCredits(userId, amount, modelId, description, projectId = null) {
  const supabase = getSupabase();
  if (!supabase) return { allowed: true, newBalance: -1 };

  const { balance, unlimited } = await getCreditsBalance(userId);

  if (unlimited) {
    await supabase.from('ai_credit_transactions').insert({
      user_id: userId,
      amount: -Math.abs(amount),
      balance_after: -1,
      type: 'usage',
      description,
      model_id: modelId,
      project_id: projectId,
    });
    return { allowed: true, newBalance: -1 };
  }

  const cost = Math.abs(amount);
  if (balance < cost) {
    return { allowed: false, newBalance: balance };
  }

  const newBalance = balance - cost;

  const { error } = await supabase
    .from('ai_credits')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('[Credits] Deduction error:', error.message);
    return { allowed: false, newBalance: balance };
  }

  await supabase.from('ai_credit_transactions').insert({
    user_id: userId,
    amount: -cost,
    balance_after: newBalance,
    type: 'usage',
    description,
    model_id: modelId,
    project_id: projectId,
  });

  return { allowed: true, newBalance };
}

/**
 * Add credits to a user's balance (purchase or grant).
 */
export async function addCredits(userId, amount, type = 'purchase', description = 'Credit purchase') {
  const supabase = getSupabase();
  if (!supabase) return { success: false };

  const { balance, unlimited } = await getCreditsBalance(userId);

  const newBalance = unlimited ? amount : balance + amount;

  const { error } = await supabase
    .from('ai_credits')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('[Credits] Add error:', error.message);
    return { success: false };
  }

  await supabase.from('ai_credit_transactions').insert({
    user_id: userId,
    amount: Math.abs(amount),
    balance_after: newBalance,
    type,
    description,
  });

  return { success: true, newBalance };
}

/**
 * Middleware: returns false and sends 403 if user has insufficient credits.
 */
export async function enforceCredits(userId, amount, res) {
  const { balance, unlimited } = await getCreditsBalance(userId);

  if (unlimited) return true;

  if (balance <= 0 || balance < Math.abs(amount)) {
    res.status(403).json({
      error: 'Insufficient AI credits',
      code: 'INSUFFICIENT_CREDITS',
      balance,
      required: Math.abs(amount),
    });
    return false;
  }

  return true;
}

/**
 * Get recent transactions for a user.
 */
export async function getTransactions(userId, limit = 50) {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('ai_credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Credits] Transactions read error:', error.message);
    return [];
  }

  return data || [];
}
