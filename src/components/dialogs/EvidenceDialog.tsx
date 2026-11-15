import { Check, ChevronRight, X } from "lucide-react";
import type { EvaluationResult } from "../../domain/evaluation";
import type { InterpretationError } from "../../types/logic";
import { BindingList, QuantifierHeading, TraceNode, TruthBadge } from "../evaluation/TraceNode";
import "../evaluation/evaluation.css";
import "../validation/validation.css";
import "./dialogs.css";

type EvidenceDialogProps = {
    evaluation: EvaluationResult | null;
    formulaInvalid: boolean;
    interpretationErrors: InterpretationError[];
    evaluationError: string | null;
    onOpenValidation: () => void;
    onClose: () => void;
};

export function EvidenceDialog({
    evaluation,
    formulaInvalid,
    interpretationErrors,
    evaluationError,
    onOpenValidation,
    onClose,
}: EvidenceDialogProps) {
    return (
        <div
            aria-labelledby="evidence-title"
            aria-modal="true"
            className="modal-backdrop"
            role="dialog"
        >
            <div className="evaluation-modal">
                <button
                    aria-label="Cerrar evidencias"
                    className="modal-close"
                    onClick={onClose}
                    type="button"
                >
                    <X size={18} />
                </button>
                <span className="eyebrow">Evaluación semántica</span>
                <h2 id="evidence-title">Evidencias de la fórmula</h2>

                {evaluation ? (
                    <EvaluationContent evaluation={evaluation} />
                ) : (
                    <BlockedContent
                        evaluationError={evaluationError}
                        formulaInvalid={formulaInvalid}
                        interpretationErrors={interpretationErrors}
                        onOpenValidation={onOpenValidation}
                    />
                )}
            </div>
        </div>
    );
}

function EvaluationContent({ evaluation }: { evaluation: EvaluationResult }) {
    const { value, trace, environment, decisiveChain } = evaluation;
    const last = decisiveChain.at(-1);

    return (
        <>
            <div className={`evaluation-verdict ${value ? "is-true" : "is-false"}`}>
                <span className="verdict-icon">{value ? <Check size={22} /> : <X size={22} />}</span>
                <div>
                    <strong>{value ? "Verdadero" : "Falso"}</strong>
                    <code>
                        ℐ {value ? "⊨" : "⊭"}
                        {environment.length > 0 ? "ₗ" : ""} {trace.formula}
                    </code>
                    <span className="verdict-environment">
                        {environment.length > 0
                            ? <>Entorno l: <BindingList bindings={environment} /></>
                            : "Enunciado: su valor no depende del entorno."}
                    </span>
                </div>
            </div>

            <section className="evaluation-block">
                <h3>Razones decisivas</h3>
                <ol className="decisive-chain">
                    {decisiveChain.map((step) => (
                        <li key={step.id}>
                            <div className="decisive-line">
                                <TruthBadge value={step.value} />
                                <code>{step.formula}</code>
                                <BindingList bindings={step.bindings} />
                            </div>
                            <p>{step.summary}</p>
                            {step.steps.length > 0 && (
                                <div className="decisive-steps">
                                    {step.steps.map((line) => <code key={line}>{line}</code>)}
                                </div>
                            )}
                        </li>
                    ))}
                </ol>
                {last?.quantifier?.mode === "complete" && <QuantifierHeading trace={last} />}
                {last && last.children.filter(({ decisive }) => decisive).length > 1 && (
                    <p className="decisive-note">
                        Los dos operandos son decisivos; su evaluación aparece en la traza completa.
                    </p>
                )}
            </section>

            <section className="evaluation-block">
                <h3>Traza completa</h3>
                <p className="evaluation-hint">
                    Cada nodo muestra su valor (V/F), las variables relevantes del entorno y por qué tiene ese valor.
                    Haz clic para expandir; los cuantificadores listan cada elemento del dominio revisado.
                </p>
                <TraceNode defaultOpen trace={trace} />
            </section>
        </>
    );
}

function BlockedContent({
    formulaInvalid,
    interpretationErrors,
    evaluationError,
    onOpenValidation,
}: Omit<EvidenceDialogProps, "evaluation" | "onClose">) {
    return (
        <div className="evaluation-blocked">
            <p className="modal-lead">
                Una entrada incompleta o inválida no recibe valor de verdad. Corrige lo siguiente para evaluar:
            </p>
            <ul>
                {formulaInvalid && (
                    <li>
                        La fórmula no está bien formada o falta el entorno.
                        <button className="validation-summary-link" onClick={onOpenValidation} type="button">
                            Ver razonamiento <ChevronRight size={15} />
                        </button>
                    </li>
                )}
                {interpretationErrors.map((error) => (
                    <li key={`${error.kind}-${error.symbol}`}>{describeInterpretationError(error)}</li>
                ))}
                {evaluationError && <li>{evaluationError}</li>}
            </ul>
        </div>
    );
}

function describeInterpretationError(error: InterpretationError): string {
    if (error.kind === "function") {
        return error.reason === "missing"
            ? `${error.symbol}ᴵ no está definida en ${error.missingCount} ${error.missingCount === 1 ? "entrada" : "entradas"}: una función debe ser total sobre Dⁿ.`
            : `${error.symbol}ᴵ tiene salidas que no pertenecen a D: fᴵ debe ir de Dⁿ a D.`;
    }
    return error.reason === "missing"
        ? `${error.symbol}ᴵ no tiene tuplas: el proyecto no admite relaciones vacías.`
        : `${error.symbol}ᴵ tiene ${error.missingCount} ${error.missingCount === 1 ? "tupla inválida" : "tuplas inválidas"} (aridad incorrecta o elementos fuera de D).`;
}
