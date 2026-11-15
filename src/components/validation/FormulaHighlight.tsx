import type { DiagnosticSeverity, Span } from "../../domain/validation";

type HighlightMark = {
    span: Span;
    severity: DiagnosticSeverity;
};

type FormulaHighlightProps = {
    text: string;
    marks: HighlightMark[];
    className?: string;
};

const severityRank: Record<DiagnosticSeverity, number> = { info: 1, warning: 2, error: 3 };

export function FormulaHighlight({ text, marks, className = "" }: FormulaHighlightProps) {
    const levels = Array.from({ length: text.length }, () => 0);
    for (const { span, severity } of marks) {
        const start = Math.max(0, span.start);
        const end = Math.min(text.length, Math.max(span.end, span.start + 1));
        for (let index = start; index < end; index += 1) {
            levels[index] = Math.max(levels[index] ?? 0, severityRank[severity]);
        }
    }

    const caretAtEnd = marks.some(({ span }) => span.start >= text.length);
    const segments: Array<{ value: string; level: number }> = [];
    for (let index = 0; index < text.length; index += 1) {
        const level = levels[index] ?? 0;
        const last = segments.at(-1);
        if (last && last.level === level) last.value += text[index];
        else segments.push({ value: text[index] ?? "", level });
    }

    return (
        <code className={`formula-highlight ${className}`}>
            {segments.map((segment, index) => (
                <span
                    className={segment.level ? `mark-${segment.level}` : undefined}
                    key={`${index}-${segment.value}`}
                >
                    {segment.value}
                </span>
            ))}
            {caretAtEnd && <span className="mark-3 mark-end"> </span>}
        </code>
    );
}
