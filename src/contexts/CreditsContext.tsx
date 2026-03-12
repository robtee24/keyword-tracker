import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { authenticatedFetch } from '../services/authService';
import { API_ENDPOINTS } from '../config/api';

interface CreditTransaction {
  id: string;
  amount: number;
  balance_after: number;
  type: string;
  description: string;
  model_id: string | null;
  created_at: string;
}

interface CreditsContextType {
  balance: number;
  unlimited: boolean;
  transactions: CreditTransaction[];
  loading: boolean;
  refreshCredits: () => Promise<void>;
  formatCost: (cost: number) => string;
}

const CreditsContext = createContext<CreditsContextType>({
  balance: -1,
  unlimited: true,
  transactions: [],
  loading: true,
  refreshCredits: async () => {},
  formatCost: () => '$0.00',
});

export function useCredits() {
  return useContext(CreditsContext);
}

export function CreditsProvider({ children, isAuthenticated }: { children: ReactNode; isAuthenticated: boolean }) {
  const [balance, setBalance] = useState(-1);
  const [unlimited, setUnlimited] = useState(true);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCredits = useCallback(async () => {
    if (!isAuthenticated) {
      setBalance(-1);
      setUnlimited(true);
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.credits.balance);
      if (resp.ok) {
        const data = await resp.json();
        setBalance(data.balance);
        setUnlimited(data.unlimited);
        setTransactions(data.transactions || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  const formatCost = useCallback((cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  }, []);

  return (
    <CreditsContext.Provider value={{ balance, unlimited, transactions, loading, refreshCredits, formatCost }}>
      {children}
    </CreditsContext.Provider>
  );
}
