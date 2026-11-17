import { X } from "lucide-react";
import { createPortal } from "react-dom";
import type { EvaluationTrace } from "../../domain/evaluation";
import { BindingList, TraceNode, TruthBadge } from "./TraceNode";
import "./evaluation.css";
import "./node-trace-dialog.css";

type NodeTraceDialogProps = {
    trace: EvaluationTrace;
    onClose: () => void;
};

export function NodeTraceDialog({ trace, onClose }: NodeTraceDialogProps) {
    return createPortal(
        <div
            aria-labelledby="node-trace-title"
            aria-modal="true"
            className="node-trace-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
            role="dialog"
        >
            <div className="node-trace-dialog">
                <button
                    aria-label="Cerrar traza del nodo"
                    className="node-trace-close"
                    onClick={onClose}
                    type="button"
                >
                    <X size={18} />
                </button>
                <span className="eyebrow">Traza del nodo</span>
                <h2 id="node-trace-title">Evaluación de <code>{trace.formula}</code></h2>

                <div className={`node-trace-verdict ${trace.value ? "is-true" : "is-false"}`}>
                    <TruthBadge value={trace.value} />
                    <strong>{trace.value ? "Verdadero" : "Falso"}</strong>
                    <BindingList bindings={trace.bindings} />
                </div>

                <p className="node-trace-summary">{trace.summary}</p>

                <section>
                    <h3>Traza de esta subfórmula</h3>
                    <TraceNode defaultOpen trace={trace} />
                </section>
            </div>
        </div>,
        document.body,
    );
}
