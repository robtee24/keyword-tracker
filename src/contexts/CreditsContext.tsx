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
  project_id: string | null;
  created_at: string;
}

interface CycleUsage {
  used: number;
  cycleTotal: number;
}

interface ProjectUsage {
  used: number;
}

interface CreditsContextType {
  balance: number;
  unlimited: boolean;
  transactions: CreditTransaction[];
  usage: CycleUsage;
  projectUsage: ProjectUsage | null;
  loading: boolean;
  refreshCredits: () => Promise<void>;
  formatCost: (cost: number) => string;
}

const CreditsContext = createContext<CreditsContextType>({
  balance: -1,
  unlimited: true,
  transactions: [],
  usage: { used: 0, cycleTotal: -1 },
  projectUsage: null,
  loading: true,
  refreshCredits: async () => {},
  formatCost: () => '$0.00',
});

export function useCredits() {
  return useContext(CreditsContext);
}

export function CreditsProvider({ children, isAuthenticated, projectId }: { children: ReactNode; isAuthenticated: boolean; projectId?: string }) {
  const [balance, setBalance] = useState(-1);
  const [unlimited, setUnlimited] = useState(true);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [usage, setUsage] = useState<CycleUsage>({ used: 0, cycleTotal: -1 });
  const [projectUsage, setProjectUsage] = useState<ProjectUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshCredits = useCallback(async () => {
    if (!isAuthenticated) {
      setBalance(-1);
      setUnlimited(true);
      setTransactions([]);
      setUsage({ used: 0, cycleTotal: -1 });
      setProjectUsage(null);
      setLoading(false);
      return;
    }

    try {
      const url = projectId
        ? `${API_ENDPOINTS.credits.balance}?projectId=${encodeURIComponent(projectId)}`
        : API_ENDPOINTS.credits.balance;
      const resp = await authenticatedFetch(url);
      if (resp.ok) {
        const data = await resp.json();
        setBalance(data.balance);
        setUnlimited(data.unlimited);
        setTransactions(data.transactions || []);
        setUsage(data.usage || { used: 0, cycleTotal: -1 });
        setProjectUsage(data.projectUsage || null);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, projectId]);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  const formatCost = useCallback((cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  }, []);

  return (
    <CreditsContext.Provider value={{ balance, unlimited, transactions, usage, projectUsage, loading, refreshCredits, formatCost }}>
      {children}
    </CreditsContext.Provider>
  );
}
