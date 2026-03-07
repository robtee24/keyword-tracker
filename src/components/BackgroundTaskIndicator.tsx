import { useState, useEffect } from 'react';
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';
import type { BackgroundTask } from '../contexts/BackgroundTaskContext';

function elapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function TaskRow({ task, onClear }: { task: BackgroundTask; onClear: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (task.status !== 'running') return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [task.status]);

  const duration = elapsed((task.status === 'running' ? now : task.completedAt ?? now) - task.startedAt);

  return (
    <div className="flex items-start gap-2.5 py-2.5 px-3 rounded-lg hover:bg-apple-fill-secondary transition-colors group">
      <div className="mt-0.5 shrink-0">
        {task.status === 'running' && (
          <span className="block w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
        )}
        {task.status === 'completed' && (
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        {task.status === 'failed' && (
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-apple-text truncate">{task.label}</p>
        <p className="text-[11px] text-apple-text-tertiary mt-0.5">
          {task.status === 'running' && `Running for ${duration}`}
          {task.status === 'completed' && `Completed in ${duration}`}
          {task.status === 'failed' && (task.error || 'Failed')}
        </p>
      </div>
      {task.status !== 'running' && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="opacity-0 group-hover:opacity-100 text-apple-text-tertiary hover:text-apple-text transition-opacity shrink-0 mt-0.5"
          title="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function BackgroundTaskIndicator() {
  const { tasks, clearTask } = useBackgroundTasks();
  const [expanded, setExpanded] = useState(false);

  const running = tasks.filter((t) => t.status === 'running');
  const finished = tasks.filter((t) => t.status !== 'running');

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2">
      {expanded && (
        <div className="w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-apple-divider overflow-hidden animate-in slide-in-from-bottom-2">
          <div className="px-4 py-3 border-b border-apple-divider flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-apple-text">Background Tasks</h3>
            <button
              onClick={() => setExpanded(false)}
              className="text-apple-text-tertiary hover:text-apple-text transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
            {running.map((t) => (
              <TaskRow key={t.id} task={t} onClear={() => clearTask(t.id)} />
            ))}
            {finished.map((t) => (
              <TaskRow key={t.id} task={t} onClear={() => clearTask(t.id)} />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border transition-all duration-200 ${
          running.length > 0
            ? 'bg-apple-blue text-white border-apple-blue hover:bg-apple-blue-hover'
            : finished.some((t) => t.status === 'failed')
              ? 'bg-white text-red-600 border-red-200 hover:bg-red-50'
              : 'bg-white text-green-600 border-green-200 hover:bg-green-50'
        }`}
      >
        {running.length > 0 ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-[13px] font-medium">
              {running.length} task{running.length !== 1 ? 's' : ''} running
            </span>
          </>
        ) : (
          <>
            {finished.some((t) => t.status === 'failed') ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="text-[13px] font-medium">
              {finished.length} task{finished.length !== 1 ? 's' : ''} done
            </span>
          </>
        )}
        {!expanded && (
          <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        )}
      </button>
    </div>
  );
}
