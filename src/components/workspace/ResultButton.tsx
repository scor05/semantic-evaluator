import { Check, X } from "lucide-react";
import {
    firstError,
    getValidationState,
    type FormulaValidation,
} from "../../domain/validation";
import type { DemonstrationResult, InterpretationError } from "../../types/logic";
import "./workspace-controls.css";

type ResultButtonProps = {
    result: DemonstrationResult;
    environmentMissing: boolean;
    interpretationErrors: InterpretationError[];
    validation: FormulaValidation;
    onOpen: () => void;
};

export function ResultButton({
    result,
    environmentMissing,
    interpretationErrors,
    validation,
    onOpen,
}: ResultButtonProps) {
    const validationState = getValidationState(validation);
    const formulaError = validationState === "invalid" ? firstError(validation) : undefined;
    const formulaEmpty = validationState === "empty";
    const missingEnvironment = environmentMissing || validationState === "incomplete";
    const hasInterpretationWarning = interpretationErrors.length > 0;
    const hasWarning = Boolean(formulaError)
        || hasInterpretationWarning
        || missingEnvironment;
    const missingInterpretations = interpretationErrors.map(({ symbol }) => symbol);
    const hasInvalidInterpretation = interpretationErrors.some(
        ({ reason }) => reason === "invalid",
    );
    const state = hasWarning
        ? "warning"
        : result === null ? "neutral" : result ? "true" : "false";
    const label = formulaError
        ? `Fórmula inválida: ${formulaError.title}`
        : hasInterpretationWarning
            ? `${hasInvalidInterpretation ? "Interpretación inválida" : "Interpretación faltante"}: ${missingInterpretations.join(", ")}`
            : missingEnvironment ? "Entorno faltante"
                : formulaEmpty || result === null ? "Sin evaluar" : result ? "Verdadero" : "Falso";

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
                    <span className="result-label" title={label}>{label}</span>
                </span>
            </button>
        </div>
    );
}
