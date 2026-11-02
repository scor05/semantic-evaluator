import { ChevronDown, ChevronUp } from "lucide-react";
import "./definition-table.css";

type ArityStepperProps = {
    value: number;
    label: string;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
};

export function ArityStepper({
    value,
    label,
    min = 0,
    max = 4,
    onChange,
}: ArityStepperProps) {
    const setClampedValue = (nextValue: number) =>
        onChange(Math.max(min, Math.min(max, nextValue)));

    return (
        <div className="arity-stepper">
            <input
                aria-label={label}
                className="arity-input"
                max={max}
                min={min}
                onChange={(event) => setClampedValue(Number(event.target.value) || min)}
                type="number"
                value={value}
            />
            <div className="arity-stepper-buttons">
                <button
                    aria-label={`Incrementar ${label.toLowerCase()}`}
                    disabled={value >= max}
                    onClick={() => setClampedValue(value + 1)}
                    type="button"
                >
                    <ChevronUp size={12} />
                </button>
                <button
                    aria-label={`Reducir ${label.toLowerCase()}`}
                    disabled={value <= min}
                    onClick={() => setClampedValue(value - 1)}
                    type="button"
                >
                    <ChevronDown size={12} />
                </button>
            </div>
        </div>
    );
}
