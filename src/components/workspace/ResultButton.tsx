import { Check, X } from "lucide-react";
import type { SyntaxArityError } from "../../domain/syntaxTree";
import type { DemonstrationResult, InterpretationError } from "../../types/logic";
import "./workspace-controls.css";

type ResultButtonProps = {
    arityErrors: SyntaxArityError[];
    result: DemonstrationResult;
    environmentMissing: boolean;
    invalidDomainSymbols: string[];
    interpretationErrors: InterpretationError[];
    onOpen: () => void;
};

export function ResultButton({
    arityErrors,
    result,
    environmentMissing,
    invalidDomainSymbols,
    interpretationErrors,
    onOpen,
}: ResultButtonProps) {
    const hasDomainWarning = invalidDomainSymbols.length > 0;
    const hasArityWarning = arityErrors.length > 0;
    const hasInterpretationWarning = interpretationErrors.length > 0;
    const hasWarning = hasDomainWarning
        || hasArityWarning
        || hasInterpretationWarning
        || environmentMissing;
    const firstArityError = arityErrors[0];
    const additionalArityErrors = Math.max(0, arityErrors.length - 1);
    const missingInterpretations = interpretationErrors.map(({ symbol }) => symbol);
    const hasInvalidInterpretation = interpretationErrors.some(
        ({ reason }) => reason === "invalid",
    );
    const state = hasWarning
        ? "warning"
        : result === null ? "neutral" : result ? "true" : "false";
    const label = hasDomainWarning
        ? `Fuera del dominio: ${invalidDomainSymbols.join(", ")}`
        : firstArityError
            ? `Aridad inválida: ${firstArityError.symbol} (${firstArityError.actual}/${firstArityError.expected})${additionalArityErrors ? ` +${additionalArityErrors}` : ""}`
        : hasInterpretationWarning
            ? `${hasInvalidInterpretation ? "Interpretación inválida" : "Interpretación faltante"}: ${missingInterpretations.join(", ")}`
        : environmentMissing ? "Entorno faltante"
        : result === null ? "Sin evaluar" : result ? "Verdadero" : "Falso";

    return (
        <div className="evidence-button-slot">
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
        </div>
    );
}
