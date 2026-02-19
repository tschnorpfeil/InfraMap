import { getGradeInfo } from '../utils/grading';

interface GradeLabelProps {
    note: number;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showLabel?: boolean;
}

export function GradeLabel({ note, size = 'md', showLabel = true }: GradeLabelProps) {
    const info = getGradeInfo(note);

    const sizeClasses: Record<string, string> = {
        sm: 'grade-label--sm',
        md: 'grade-label--md',
        lg: 'grade-label--lg',
        xl: 'grade-label--xl',
    };

    return (
        <span
            className={`grade-label ${sizeClasses[size] ?? ''}`}
            style={{
                color: info.color,
                backgroundColor: info.bgColor,
                borderColor: info.color,
            }}
        >
            <span className="grade-label__note">{note.toFixed(1)}</span>
            {showLabel && <span className="grade-label__text">{info.label}</span>}
        </span>
    );
}
