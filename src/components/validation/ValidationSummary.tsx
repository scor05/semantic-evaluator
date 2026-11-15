import { AlertTriangle, CheckCircle2, ChevronRight, CircleDashed, XCircle } from "lucide-react";
import {
    firstError,
    getValidationState,
    type FormulaValidation,
} from "../../domain/validation";
import { FormulaHighlight } from "./FormulaHighlight";
import "./validation.css";

type ValidationSummaryProps = {
    validation: FormulaValidation;
    onOpen: () => void;
};

export function ValidationSummary({ validation, onOpen }: ValidationSummaryProps) {
    const state = getValidationState(validation);
    const error = firstError(validation);
    const errorCount = validation.diagnostics.filter(({ severity }) => severity === "error").length;
    const warningCount = validation.diagnostics.filter(({ severity }) => severity === "warning").length;

    if (state === "empty") {
        return (
            <div className="validation-summary is-empty">
                <CircleDashed size={16} />
                <span>Escribe una fórmula para validarla.</span>
            </div>
        );
    }

    const headline = state === "invalid"
        ? "No es una fórmula bien formada"
        : state === "incomplete"
            ? "Bien formada · falta el entorno"
            : warningCount > 0
                ? `Bien formada · ${warningCount} ${warningCount === 1 ? "observación" : "observaciones"}`
                : "Fórmula bien formada";
    const tone = state === "invalid" ? "error" : state === "incomplete" || warningCount > 0 ? "warning" : "ok";
    const Icon = tone === "error" ? XCircle : tone === "warning" ? AlertTriangle : CheckCircle2;

    return (
        <div className={`validation-summary is-${tone}`} role={tone === "error" ? "alert" : "status"}>
            <div className="validation-summary-heading">
                <Icon size={16} />
                <strong>{headline}</strong>
            </div>
            {error ? (
                <>
                    <p>{error.title}</p>
                    {error.span && (
                        <FormulaHighlight
                            className="summary-snippet"
                            marks={[{ span: error.span, severity: error.severity }]}
                            text={validation.input}
                        />
                    )}
                </>
            ) : (
                <p>
                    {validation.freeVariables.length > 0
                        ? `Abierta · libres: ${validation.freeVariables.join(", ")}`
                        : "Cerrada · es un enunciado"}
                </p>
            )}
            <button className="validation-summary-link" onClick={onOpen} type="button">
                Ver razonamiento
                {errorCount > 1 && <span className="validation-count">{errorCount} errores</span>}
                <ChevronRight size={15} />
            </button>
        </div>
    );
}
