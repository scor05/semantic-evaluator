import { Check, X } from "lucide-react";
import type { DemonstrationResult } from "../../types/logic";
import "./workspace-controls.css";

type ResultButtonProps = {
    result: DemonstrationResult;
    environmentMissing: boolean;
    invalidDomainSymbols: string[];
    onOpen: () => void;
};

export function ResultButton({
    result,
    environmentMissing,
    invalidDomainSymbols,
    onOpen,
}: ResultButtonProps) {
    const hasDomainWarning = invalidDomainSymbols.length > 0;
    const hasWarning = hasDomainWarning || environmentMissing;
    const state = hasWarning
        ? "warning"
        : result === null ? "neutral" : result ? "true" : "false";
    const label = hasDomainWarning
        ? `Fuera del dominio: ${invalidDomainSymbols.join(", ")}`
        : environmentMissing ? "Entorno faltante"
        : result === null ? "Sin evaluar" : result ? "Verdadero" : "Falso";

    return (
        <button
            aria-label={`Resultado de demostración: ${label.toLowerCase()}. Ver evidencias`}
            className={`evidence-button is-${state}`}
            onClick={onOpen}
            type="button"
        >
            <span className="result-indicator" aria-hidden="true">
                {hasWarning ? (
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
