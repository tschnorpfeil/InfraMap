import { getGradeInfo } from '../utils/grading';
import { CircleCheckIcon, CircleAlertIcon, CircleXIcon } from './Icons';

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

    const renderIcon = () => {
        const props = { className: "grade-label__icon" };
        switch (info.iconName) {
            case 'circle-check': return <CircleCheckIcon {...props} />;
            case 'circle-alert': return <CircleAlertIcon {...props} />;
            case 'circle-x': return <CircleXIcon {...props} />;
        }
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
            {size !== 'sm' && <span className="grade-label__icon-wrapper">{renderIcon()}</span>}
            <span className="grade-label__note">{note.toFixed(1)}</span>
            {showLabel && <span className="grade-label__text">{info.label}</span>}
        </span>
    );
}
