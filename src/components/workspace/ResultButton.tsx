import { Check, X } from "lucide-react";
import type { DemonstrationResult } from "../../types/logic";
import "./workspace-controls.css";

type ResultButtonProps = {
    result: DemonstrationResult;
    environmentMissing: boolean;
    onOpen: () => void;
};

export function ResultButton({ result, environmentMissing, onOpen }: ResultButtonProps) {
    const state = environmentMissing
        ? "warning"
        : result === null ? "neutral" : result ? "true" : "false";
    const label = environmentMissing
        ? "Entorno faltante"
        : result === null ? "Sin evaluar" : result ? "Verdadero" : "Falso";

    return (
        <button
            aria-label={`Resultado de demostración: ${label.toLowerCase()}. Ver evidencias`}
            className={`evidence-button is-${state}`}
            onClick={onOpen}
            type="button"
        >
            <span className="result-indicator" aria-hidden="true">
                {environmentMissing ? (
                    <span>!</span>
                ) : result === null ? (
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
