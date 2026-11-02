import { X } from "lucide-react";
import "./dialogs.css";

type EvidenceDialogProps = {
    onClose: () => void;
};

const evidence = [
    ["Universal verdadero", "Se mostrará la comprobación para cada elemento del dominio."],
    ["Testigo existencial", "Se identificará el primer valor que satisface la subfórmula."],
    ["Traza decisiva", "Cada conectivo señalará qué resultado determinó su valor."],
];

export function EvidenceDialog({ onClose }: EvidenceDialogProps) {
    return (
        <div
            aria-labelledby="evidence-title"
            aria-modal="true"
            className="modal-backdrop"
            role="dialog"
        >
            <div className="evidence-modal">
                <button
                    aria-label="Cerrar evidencias"
                    className="modal-close"
                    onClick={onClose}
                    type="button"
                >
                    <X size={18} />
                </button>
                <h2 id="evidence-title">Evidencias de la fórmula</h2>
                <p className="modal-lead">
                    Esta tarjeta muestra cómo se presentarán las razones decisivas del resultado.
                </p>
                <div className="evidence-list">
                    {evidence.map(([title, description], index) => (
                        <div key={title}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <p>
                                <strong>{title}</strong>
                                {description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
