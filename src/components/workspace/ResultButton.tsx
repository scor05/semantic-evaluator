import { Check, X } from "lucide-react";
import type { DemonstrationResult } from "../../types/logic";
import "./workspace-controls.css";

type ResultButtonProps = {
    result: DemonstrationResult;
    onOpen: () => void;
};

export function ResultButton({ result, onOpen }: ResultButtonProps) {
    const state = result === null ? "neutral" : result ? "true" : "false";
    const label = result === null ? "Sin evaluar" : result ? "Verdadero" : "Falso";

    return (
        <button
            aria-label={`Resultado de demostración: ${label.toLowerCase()}. Ver evidencias`}
            className={`evidence-button is-${state}`}
            onClick={onOpen}
            type="button"
        >
            <span className="result-indicator" aria-hidden="true">
                {result === null ? (
                    <span>?</span>
                ) : result ? (
                    <Check size={18} strokeWidth={2.5} />
                ) : (
                    <X size={18} strokeWidth={2.5} />
                )}
            </span>
            <span className="result-copy">
                <small>Resultado de demostración</small>
                {label}
            </span>
        </button>
    );
}
