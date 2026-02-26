import { useState, useRef, useEffect, type ReactNode } from 'react';

interface TooltipProps {
  text: string;
  children?: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
}

export default function Tooltip({ text, children, position = 'top', maxWidth = 260 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;
    const tr = triggerRef.current.getBoundingClientRect();
    const tt = tooltipRef.current.getBoundingClientRect();
    let top = 0;
    let left = 0;
    const gap = 6;

    if (position === 'top') {
      top = tr.top - tt.height - gap;
      left = tr.left + tr.width / 2 - tt.width / 2;
    } else if (position === 'bottom') {
      top = tr.bottom + gap;
      left = tr.left + tr.width / 2 - tt.width / 2;
    } else if (position === 'left') {
      top = tr.top + tr.height / 2 - tt.height / 2;
      left = tr.left - tt.width - gap;
    } else {
      top = tr.top + tr.height / 2 - tt.height / 2;
      left = tr.right + gap;
    }

    left = Math.max(8, Math.min(left, window.innerWidth - tt.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tt.height - 8));

    setCoords({ top, left });
  }, [visible, position]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="inline-flex items-center cursor-help"
      >
        {children || (
          <svg className="w-3.5 h-3.5 text-apple-text-tertiary hover:text-apple-text-secondary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </span>
      {visible && (
        <div
          ref={tooltipRef}
          className="fixed z-[100] px-3 py-2 rounded-apple-sm bg-gray-900 text-white text-apple-xs leading-relaxed shadow-apple-lg pointer-events-none animate-in fade-in duration-150"
          style={{ top: coords.top, left: coords.left, maxWidth }}
        >
          {text}
        </div>
      )}
    </>
  );
}

export function InfoTooltip({ text, position }: { text: string; position?: 'top' | 'bottom' | 'left' | 'right' }) {
  return <Tooltip text={text} position={position} />;
}
