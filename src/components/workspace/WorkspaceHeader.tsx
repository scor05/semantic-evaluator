import { CircleHelp } from "lucide-react";
import {
    firstError,
    getValidationState,
    type FormulaValidation,
} from "../../domain/validation";
import type { InterpretationError } from "../../types/logic";
import { SpotifyDialog } from "../dialogs/SpotifyDialog.tsx";
import "../../styles/shared-controls.css";
import "../validation/validation.css";
import "./workspace-shell.css";

type WorkspaceHeaderProps = {
    formula: string;
    freeVariables: string[];
    interpretationErrors: InterpretationError[];
    validation: FormulaValidation;
    onOpenHelp: () => void;
    onOpenValidation: () => void;
};

export function WorkspaceHeader({
    formula,
    freeVariables,
    interpretationErrors,
    validation,
    onOpenHelp,
    onOpenValidation,
}: WorkspaceHeaderProps) {
    const isOpen = freeVariables.length > 0;
    const formulaError = getValidationState(validation) === "invalid" ? firstError(validation) : undefined;
    const hasInterpretationError = interpretationErrors.length > 0;
    const hasInvalidInterpretation = interpretationErrors.some(
        ({ reason }) => reason === "invalid",
    );
    const hasFormulaError = Boolean(formulaError) || hasInterpretationError;
    const status = hasFormulaError ? "invalid" : isOpen ? "open" : "closed";

    return (
        <header className="workspace-header">
            <div className="scene-title">
                <span className="eyebrow">Árbol sintáctico</span>
                <h1>{formula || "Tu fórmula aparecerá aquí"}</h1>
                {formula && formulaError && (
                    <button
                        className="formula-status formula-status-button is-invalid"
                        onClick={onOpenValidation}
                        type="button"
                    >
                        <span className="status-dot" />
                        {`Fórmula inválida · ${formulaError.title}`}
                    </button>
                )}
                {formula && !formulaError && (
                    <p className={`formula-status is-${status}`}>
                        <span className="status-dot" />
                        {hasInterpretationError
                            ? `${hasInvalidInterpretation ? "Interpretación inválida" : "Interpretación faltante"} · ${interpretationErrors.map(({ symbol }) => symbol).join(", ")}`
                            : isOpen
                                ? `Fórmula abierta · ${freeVariables.join(", ")} ${freeVariables.length === 1 ? "libre" : "libres"}`
                                : "Fórmula cerrada"}
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
