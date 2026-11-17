import { CircleHelp } from "lucide-react";
import {
    firstError,
    getValidationState,
    type FormulaValidation,
} from "../../domain/validation";
import type { DemonstrationResult, InterpretationError } from "../../types/logic";
import { SpotifyDialog } from "../dialogs/SpotifyDialog.tsx";
import "../../styles/shared-controls.css";
import "../validation/validation.css";
import "./workspace-shell.css";

type WorkspaceHeaderProps = {
    formula: string;
    freeVariables: string[];
    interpretationErrors: InterpretationError[];
    result: DemonstrationResult;
    validation: FormulaValidation;
    onOpenHelp: () => void;
    onOpenValidation: () => void;
};

export function WorkspaceHeader({
    formula,
    freeVariables,
    interpretationErrors,
    result,
    validation,
    onOpenHelp,
    onOpenValidation,
}: WorkspaceHeaderProps) {
    const isOpen = freeVariables.length > 0;
    const validationState = getValidationState(validation);
    const firstValidationError = validationState === "invalid" || validationState === "incomplete"
        ? firstError(validation)
        : undefined;
    const formulaError = validationState === "invalid" ? firstValidationError : undefined;
    const unrecognizedValue = firstValidationError?.code === "environment-value-outside-domain"
        ? firstValidationError
        : undefined;
    const formulaIssue = formulaError ?? unrecognizedValue;
    const hasInterpretationError = interpretationErrors.length > 0;
    const hasInvalidInterpretation = interpretationErrors.some(
        ({ reason }) => reason === "invalid",
    );
    const hasFormulaError = Boolean(formulaIssue) || hasInterpretationError;
    const status = hasFormulaError
        ? "invalid"
        : isOpen
            ? "open"
            : result === null
                ? "closed"
                : result
                    ? "true"
                    : "false";

    return (
        <header className="workspace-header">
            <div className="scene-title">
                <span className="eyebrow">Árbol sintáctico</span>
                <h1>{formula || "Tu fórmula aparecerá aquí"}</h1>
                {formula && formulaIssue && (
                    <button
                        className="formula-status formula-status-button is-invalid"
                        onClick={onOpenValidation}
                        type="button"
                    >
                        <span className="status-dot" />
                        {unrecognizedValue
                            ? `Símbolo no reconocido · ${unrecognizedValue.title}`
                            : `Fórmula inválida · ${formulaIssue.title}`}
                    </button>
                )}
                {formula && !formulaIssue && (
                    <p className={`formula-status is-${status}`}>
                        <span className="status-dot" />
                        {hasInterpretationError
                            ? `${hasInvalidInterpretation ? "Interpretación inválida" : "Interpretación faltante"} · ${interpretationErrors.map(({ symbol }) => symbol).join(", ")}`
                            : isOpen
                                ? `Fórmula abierta · ${freeVariables.join(", ")} ${freeVariables.length === 1 ? "libre" : "libres"}`
                                : result === null
                                    ? "Fórmula cerrada"
                                    : result
                                        ? "Fórmula verdadera"
                                        : "Fórmula falsa"}
                    </p>
                )}
            </div>
            <div className="header-actions">
                <button className="header-button" onClick={onOpenHelp} type="button">
                    <CircleHelp size={17} />
                    <span>Ayuda</span>
                </button>
            </div>
        </header>
    );
}
