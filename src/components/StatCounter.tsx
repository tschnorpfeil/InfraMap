import { useEffect, useRef, useState } from 'react';

interface StatCounterProps {
    end: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    className?: string;
}

export function StatCounter({
    end,
    duration = 2000,
    prefix = '',
    suffix = '',
    decimals = 0,
    className = '',
}: StatCounterProps) {
    const [current, setCurrent] = useState(0);
    const frameRef = useRef<number>(0);
    const startTime = useRef<number>(0);

    useEffect(() => {
        startTime.current = performance.now();

        function animate(now: number) {
            const elapsed = now - startTime.current;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCurrent(eased * end);

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            }
        }

        frameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameRef.current);
    }, [end, duration]);

    const formatted = decimals > 0
        ? current.toFixed(decimals)
        : Math.round(current).toLocaleString('de-DE');

    return (
        <span className={`stat-counter ${className}`}>
            {prefix}{formatted}{suffix}
        </span>
    );
}
