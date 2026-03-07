import { createContext, useContext, useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface BackgroundTask {
  id: string;
  type: string;
  label: string;
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

interface BackgroundTaskContextValue {
  startTask: (id: string, type: string, label: string, fn: () => Promise<unknown>) => void;
  getTask: (id: string) => BackgroundTask | undefined;
  getTasksByType: (type: string) => BackgroundTask[];
  clearTask: (id: string) => void;
  clearTasksByType: (type: string) => void;
  tasks: BackgroundTask[];
}

const BackgroundTaskContext = createContext<BackgroundTaskContextValue>({
  startTask: () => {},
  getTask: () => undefined,
  getTasksByType: () => [],
  clearTask: () => {},
  clearTasksByType: () => {},
  tasks: [],
});

export function useBackgroundTasks() {
  return useContext(BackgroundTaskContext);
}

const AUTO_CLEAR_MS = 5 * 60 * 1000;

export function BackgroundTaskProvider({ children }: { children: ReactNode }) {
  const taskMap = useRef(new Map<string, BackgroundTask>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const startTask = useCallback(
    (id: string, type: string, label: string, fn: () => Promise<unknown>) => {
      const existing = taskMap.current.get(id);
      if (existing?.status === 'running') return;

      const task: BackgroundTask = { id, type, label, status: 'running', startedAt: Date.now() };
      taskMap.current.set(id, task);
      bump();

      fn()
        .then((result) => {
          taskMap.current.set(id, { ...task, status: 'completed', result, completedAt: Date.now() });
          bump();
          const timer = setTimeout(() => {
            taskMap.current.delete(id);
            timers.current.delete(id);
            bump();
          }, AUTO_CLEAR_MS);
          timers.current.set(id, timer);
        })
        .catch((err) => {
          taskMap.current.set(id, {
            ...task,
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
            completedAt: Date.now(),
          });
          bump();
          const timer = setTimeout(() => {
            taskMap.current.delete(id);
            timers.current.delete(id);
            bump();
          }, AUTO_CLEAR_MS);
          timers.current.set(id, timer);
        });
    },
    [bump],
  );

  const getTask = useCallback((id: string) => taskMap.current.get(id), []);

  const getTasksByType = useCallback(
    (type: string) => Array.from(taskMap.current.values()).filter((t) => t.type === type),
    [],
  );

  const clearTask = useCallback(
    (id: string) => {
      taskMap.current.delete(id);
      const timer = timers.current.get(id);
      if (timer) { clearTimeout(timer); timers.current.delete(id); }
      bump();
    },
    [bump],
  );

  const clearTasksByType = useCallback(
    (type: string) => {
      for (const [id, t] of taskMap.current) {
        if (t.type === type) {
          taskMap.current.delete(id);
          const timer = timers.current.get(id);
          if (timer) { clearTimeout(timer); timers.current.delete(id); }
        }
      }
      bump();
    },
    [bump],
  );

  const tasks = Array.from(taskMap.current.values());

  return (
    <BackgroundTaskContext.Provider value={{ startTask, getTask, getTasksByType, clearTask, clearTasksByType, tasks }}>
      {children}
    </BackgroundTaskContext.Provider>
  );
}
