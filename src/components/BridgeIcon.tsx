import type { SVGProps } from 'react';

/**
 * Custom bridge icon — Minimalist Stabbogenbrücke (Tied-arch bridge)
 * Abstract, sleek, and highly recognizable. 
 * Represents a typical German river/canal bridge.
 */
export function BridgeIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            {/* Main road deck */}
            <path d="M2 15h20" />

            {/* Abutments / Foundations going down */}
            <path d="M4 15v5" />
            <path d="M20 15v5" />

            {/* Perfect semicircle arch spanning from x=4 to x=20 (radius=8) */}
            <path d="M4 15a8 8 0 0 1 16 0" />

            {/* Vertical hangers connecting arch to deck */}
            {/* Center hanger */}
            <path d="M12 7v8" />
            {/* Left hanger */}
            <path d="M8 8v7" />
            {/* Right hanger */}
            <path d="M16 8v7" />
        </svg>
    );
}
