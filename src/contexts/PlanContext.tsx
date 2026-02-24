import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { fetchCurrentPlan } from '../services/planService';
import type { UserPlanInfo, PlanId } from '../config/plans';
import { PLANS, isLimitReached, isFeatureLocked } from '../config/plans';

interface PlanContextType {
  planInfo: UserPlanInfo | null;
  loading: boolean;
  refreshPlan: () => Promise<void>;
  canUseFeature: (feature: string) => boolean;
  isLimitExhausted: (field: keyof UserPlanInfo['usage']) => boolean;
  getRemaining: (field: keyof UserPlanInfo['limits']) => number;
  planId: PlanId;
}

const PlanContext = createContext<PlanContextType>({
  planInfo: null,
  loading: true,
  refreshPlan: async () => {},
  canUseFeature: () => true,
  isLimitExhausted: () => false,
  getRemaining: () => -1,
  planId: 'base',
});

export function usePlan() {
  return useContext(PlanContext);
}

export function PlanProvider({ children, isAuthenticated }: { children: ReactNode; isAuthenticated: boolean }) {
  const [planInfo, setPlanInfo] = useState<UserPlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshPlan = useCallback(async () => {
    if (!isAuthenticated) {
      setPlanInfo(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const info = await fetchCurrentPlan();
    setPlanInfo(info);
    setLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    refreshPlan();
  }, [refreshPlan]);

  const planId = (planInfo?.plan || 'base') as PlanId;
  const plan = PLANS[planId] || PLANS.base;

  const canUseFeature = useCallback((feature: string) => {
    if (!planInfo) return false;
    return !isFeatureLocked(planId, feature);
  }, [planInfo, planId]);

  const isLimitExhausted = useCallback((field: keyof UserPlanInfo['usage']) => {
    if (!planInfo) return false;
    const limit = plan.limits[field as keyof typeof plan.limits];
    const current = Number(planInfo.usage[field] || 0);
    return isLimitReached(current, Number(limit));
  }, [planInfo, plan]);

  const getRemaining = useCallback((field: keyof UserPlanInfo['limits']) => {
    if (!planInfo) return -1;
    const limit = plan.limits[field];
    if (limit === -1) return -1;
    if (limit === 0) return 0;
    const usage = Number(planInfo.usage[field as keyof typeof planInfo.usage] || 0);
    return Math.max(0, Number(limit) - usage);
  }, [planInfo, plan]);

  return (
    <PlanContext.Provider value={{ planInfo, loading, refreshPlan, canUseFeature, isLimitExhausted, getRemaining, planId }}>
      {children}
    </PlanContext.Provider>
  );
}
