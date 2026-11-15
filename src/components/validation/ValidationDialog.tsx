import {
    AlertTriangle,
    BookOpen,
    CheckCircle2,
    CircleDashed,
    Info,
    Lightbulb,
    X,
    XCircle,
} from "lucide-react";
import {
    firstError,
    getValidationState,
    stageTitles,
    type FormulaDiagnostic,
    type FormulaValidation,
    type StageStatus,
} from "../../domain/validation";
import "../dialogs/dialogs.css";
import { FormulaHighlight } from "./FormulaHighlight";
import "./validation.css";

type ValidationDialogProps = {
    validation: FormulaValidation;
    onClose: () => void;
};

const stageIcons: Record<StageStatus, typeof CheckCircle2> = {
    passed: CheckCircle2,
    warning: AlertTriangle,
    failed: XCircle,
    skipped: CircleDashed,
};

export function ValidationDialog({ validation, onClose }: ValidationDialogProps) {
    const state = getValidationState(validation);
    const error = firstError(validation);
    const errors = validation.diagnostics.filter(({ severity }) => severity === "error");
    const warnings = validation.diagnostics.filter(({ severity }) => severity === "warning");
    const notes = validation.diagnostics.filter(({ severity }) => severity === "info");
    const marks = validation.diagnostics.flatMap(({ span, severity }) =>
        span && severity !== "info" ? [{ span, severity }] : []
    );

    return (
        <div aria-labelledby="validation-title" aria-modal="true" className="modal-backdrop" role="dialog">
            <div className="validation-modal">
                <button aria-label="Cerrar validación" className="modal-close" onClick={onClose} type="button">
                    <X size={18} />
                </button>
                <span className="eyebrow">Validador sintáctico</span>
                <h2 id="validation-title">Razonamiento de la validación</h2>

                <div className={`validation-verdict is-${state}`}>
                    <strong>{verdictTitle(state)}</strong>
                    <p>{verdictText(state, error, validation)}</p>
                </div>

                {validation.input.trim() && (
                    <section className="validation-block">
                        <h3>{validation.source === "text" ? "Expresión escrita" : "Expresión reconstruida desde el árbol"}</h3>
                        <FormulaHighlight className="validation-formula" marks={marks} text={validation.input} />
                        {validation.reading && validation.reading !== validation.input.trim() && (
                            <p className="validation-reading">
                                Lectura según las reglas de formación: <code>{validation.reading}</code>
                            </p>
                        )}
                    </section>
                )}

                <section className="validation-block">
                    <h3>Etapas</h3>
                    <ol className="validation-stages">
                        {validation.stages.map((stage) => {
                            const Icon = stageIcons[stage.status];
                            return (
                                <li className={`is-${stage.status}`} key={stage.stage}>
                                    <Icon size={16} />
                                    <div>
                                        <strong>{stage.title}</strong>
                                        <span>{stage.summary}</span>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </section>

                <DiagnosticGroup diagnostics={errors} title="Por qué falla" validation={validation} />
                <DiagnosticGroup diagnostics={warnings} title="Observaciones" validation={validation} />
                <DiagnosticGroup diagnostics={notes} title="Notas de lectura" validation={validation} />
            </div>
        </div>
    );
}

type DiagnosticGroupProps = {
    title: string;
    diagnostics: FormulaDiagnostic[];
    validation: FormulaValidation;
};

function DiagnosticGroup({ title, diagnostics, validation }: DiagnosticGroupProps) {
    if (diagnostics.length === 0) return null;
    return (
        <section className="validation-block">
            <h3>{title}</h3>
            <div className="diagnostic-list">
                {diagnostics.map((diagnostic, index) => (
                    <DiagnosticCard
                        diagnostic={diagnostic}
                        key={`${diagnostic.code}-${diagnostic.nodeId ?? index}-${index}`}
                        validation={validation}
                    />
                ))}
            </div>
        </section>
    );
}

function DiagnosticCard({ diagnostic, validation }: { diagnostic: FormulaDiagnostic; validation: FormulaValidation }) {
    const Icon = diagnostic.severity === "error" ? XCircle : diagnostic.severity === "warning" ? AlertTriangle : Info;
    return (
        <article className={`diagnostic-card is-${diagnostic.severity}`}>
            <header>
                <Icon size={17} />
                <div>
                    <span className="diagnostic-stage">{stageTitles[diagnostic.stage]}</span>
                    <strong>{diagnostic.title}</strong>
                </div>
            </header>

            {diagnostic.span && (
                <div className="diagnostic-location">
                    <span>{locationText(diagnostic, validation)}</span>
                    <FormulaHighlight
                        marks={[{ span: diagnostic.span, severity: diagnostic.severity }]}
                        text={validation.input}
                    />
                </div>
            )}

            <ol className="diagnostic-reasoning">
                {diagnostic.reasoning.map((step) => <li key={step}>{step}</li>)}
            </ol>

            {diagnostic.rule && (
                <div className="diagnostic-rule">
                    <BookOpen size={14} />
                    <span><strong>Regla del curso.</strong> {diagnostic.rule}</span>
                </div>
            )}
            {diagnostic.hint && (
                <div className="diagnostic-hint">
                    <Lightbulb size={14} />
                    <span>{diagnostic.hint}</span>
                </div>
            )}
        </article>
    );
}

function locationText(diagnostic: FormulaDiagnostic, validation: FormulaValidation): string {
    const span = diagnostic.span;
    if (!span) return "";
    if (validation.source === "tree") return "Nodo del árbol";
    if (span.start >= validation.input.length) return "Al final de la fórmula";
    const start = span.start + 1;
    const end = Math.max(start, span.end);
    return start === end ? `Columna ${start}` : `Columnas ${start}–${end}`;
}

function verdictTitle(state: ReturnType<typeof getValidationState>): string {
    switch (state) {
        case "empty":
            return "Sin fórmula";
        case "invalid":
            return "Entrada inválida · no recibe valor de verdad";
        case "incomplete":
            return "Fórmula bien formada · entorno incompleto";
        case "valid":
            return "Fórmula bien formada";
    }
}

function verdictText(
    state: ReturnType<typeof getValidationState>,
    error: FormulaDiagnostic | undefined,
    validation: FormulaValidation,
): string {
    if (state === "empty") return "Escribe una fórmula o construye un árbol para validarla.";
    if (state === "invalid") {
        const failed = validation.stages.find(({ status }) => status === "failed");
        return `La expresión no se puede obtener con las reglas de formación del lenguaje. La primera etapa que falla es «${failed?.title ?? "—"}»: ${error?.title ?? ""}.`;
    }
    if (state === "incomplete") {
        const missing = validation.diagnostics
            .filter(({ stage, severity }) => stage === "environment" && severity === "error")
            .map(({ title }) => title);
        return `La fórmula es abierta y el entorno aún no asigna un elemento de D a todas sus variables libres. ${missing[0] ?? ""}.`;
    }
    return validation.freeVariables.length > 0
        ? `Es una fórmula abierta con ${validation.freeVariables.join(", ")} libres y un entorno completo; puede evaluarse.`
        : "Es un enunciado (fórmula cerrada): su valor de verdad no depende del entorno.";
}
