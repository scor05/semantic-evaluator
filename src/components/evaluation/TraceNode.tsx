import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Binding, EvaluationTrace } from "../../domain/evaluation";

type TraceNodeProps = {
    trace: EvaluationTrace;
    role?: string;
    decisive?: boolean;
    depth?: number;
    defaultOpen?: boolean;
    highlight?: "witness" | "counterexample";
};

const maxAutoOpenDepth = 8;

export function TraceNode({
    trace,
    role,
    decisive = true,
    depth = 0,
    defaultOpen = false,
    highlight,
}: TraceNodeProps) {
    const [open, setOpen] = useState(defaultOpen);
    const quantifier = trace.quantifier;

    return (
        <div className={`trace-node ${decisive ? "" : "is-secondary"} ${highlight ? `is-${highlight}` : ""}`}>
            <button
                aria-expanded={open}
                className="trace-header"
                onClick={() => setOpen((current) => !current)}
                type="button"
            >
                <ChevronRight className={`trace-chevron ${open ? "is-open" : ""}`} size={15} />
                <TruthBadge value={trace.value} />
                {role && <span className="trace-role">{role}</span>}
                {highlight && (
                    <span className="trace-tag">{highlight === "witness" ? "Testigo" : "Contraejemplo"}</span>
                )}
                <code className="trace-formula">{trace.formula}</code>
                <BindingList bindings={trace.bindings} />
            </button>

            {open && (
                <div className="trace-body">
                    <p className="trace-summary">{trace.summary}</p>

                    {trace.steps.length > 0 && (
                        <ol className="trace-steps">
                            {trace.steps.map((step) => <li key={step}><code>{step}</code></li>)}
                        </ol>
                    )}

                    {trace.children.length > 0 && (
                        <div className="trace-children">
                            {trace.children.map((child) => (
                                <TraceNode
                                    decisive={child.decisive}
                                    defaultOpen={child.decisive && depth < maxAutoOpenDepth}
                                    depth={depth + 1}
                                    key={child.trace.id}
                                    role={child.decisive ? child.role : `${child.role} · no decisivo`}
                                    trace={child.trace}
                                />
                            ))}
                        </div>
                    )}

                    {quantifier && (
                        <div className="trace-children">
                            <QuantifierHeading trace={trace} />
                            {quantifier.checks.map((check) => {
                                const isDecisive = check.element === quantifier.decisiveElement;
                                return (
                                    <TraceNode
                                        decisive={quantifier.mode === "complete" || isDecisive}
                                        defaultOpen={isDecisive && depth < maxAutoOpenDepth}
                                        depth={depth + 1}
                                        highlight={isDecisive && quantifier.mode !== "complete" ? quantifier.mode : undefined}
                                        key={check.trace.id}
                                        role={`${quantifier.variable} = ${check.element}`}
                                        trace={check.trace}
                                    />
                                );
                            })}
                            {quantifier.unchecked.length > 0 && (
                                <p className="trace-unchecked">
                                    No hace falta revisar {quantifier.variable} = {quantifier.unchecked.join(", ")}:
                                    {quantifier.mode === "witness"
                                        ? " ya se encontró un testigo."
                                        : " ya se encontró un contraejemplo."}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function TruthBadge({ value }: { value: boolean }) {
    return (
        <span className={`truth-badge ${value ? "is-true" : "is-false"}`} title={value ? "Verdadero" : "Falso"}>
            {value ? "V" : "F"}
        </span>
    );
}

export function BindingList({ bindings }: { bindings: Binding[] }) {
    if (bindings.length === 0) return null;
    return (
        <span className="trace-bindings">
            {bindings.map(({ variable, value }) => `${variable} ↦ ${value}`).join(", ")}
        </span>
    );
}

export function QuantifierHeading({ trace }: { trace: EvaluationTrace }) {
    const quantifier = trace.quantifier;
    if (!quantifier) return null;
    const label = quantifier.mode === "witness"
        ? `Testigo: ${quantifier.variable} = ${quantifier.decisiveElement}`
        : quantifier.mode === "counterexample"
            ? `Contraejemplo: ${quantifier.variable} = ${quantifier.decisiveElement}`
            : `Comprobación completa: ${quantifier.checks.length} de ${quantifier.checks.length} elementos`;
    return (
        <div className={`quantifier-heading is-${quantifier.mode}`}>
            <strong>{label}</strong>
            <div className="check-strip" aria-label="Resultado por elemento">
                {quantifier.checks.map((check) => (
                    <span
                        className={`check-chip ${check.value ? "is-true" : "is-false"} ${check.element === quantifier.decisiveElement ? "is-decisive" : ""}`}
                        key={check.element}
                    >
                        {check.element}: {check.value ? "V" : "F"}
                    </span>
                ))}
                {quantifier.unchecked.map((element) => (
                    <span className="check-chip is-unchecked" key={element}>{element}: —</span>
                ))}
            </div>
        </div>
    );
}
