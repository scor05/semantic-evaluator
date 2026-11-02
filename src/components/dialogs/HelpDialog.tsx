import { Info, Keyboard, X } from "lucide-react";
import "../../styles/shared-controls.css";
import "./dialogs.css";

type HelpDialogProps = {
    onClose: () => void;
};

const controls = [
    { keys: ["Q", "E"], title: "Acercar y alejar", description: "Ajusta la escala de la vista." },
    { keys: ["A", "D"], title: "Rotación horizontal", description: "Gira la cámara sobre el eje Y." },
    { keys: ["W", "S"], title: "Rotación vertical", description: "Gira la cámara sobre el eje X." },
    { keys: ["Z", "X"], title: "Inclinación", description: "Gira la cámara sobre el eje Z." },
];

export function HelpDialog({ onClose }: HelpDialogProps) {
    return (
        <div aria-labelledby="help-title" aria-modal="true" className="modal-backdrop" role="dialog">
            <div className="help-modal">
                <button aria-label="Cerrar ayuda" className="modal-close" onClick={onClose} type="button">
                    <X size={18} />
                </button>
                <div className="modal-icon help-icon">
                    <Keyboard size={23} />
                </div>
                <span className="eyebrow">Navegación y edición</span>
                <h2 id="help-title">Controles</h2>
                <p className="modal-lead">
                    Los controles mantienen el esquema usado en los proyectos de renderizado anteriores.
                </p>

                <div className="controls-list">
                    <div className="control-row">
                        <div className="key-group arrow-keys" aria-label="Flechas">
                            <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd>
                        </div>
                        <div>
                            <strong>Desplazar cámara</strong>
                            <span>Mueve la vista sobre el plano.</span>
                        </div>
                    </div>
                    {controls.map((control) => (
                        <div className="control-row" key={control.title}>
                            <div className="key-group">
                                {control.keys.map((key) => <kbd key={key}>{key}</kbd>)}
                            </div>
                            <div>
                                <strong>{control.title}</strong>
                                <span>{control.description}</span>
                            </div>
                        </div>
                    ))}
                    <div className="control-row edit-control-row">
                        <div className="key-group"><kbd>Ctrl</kbd></div>
                        <div>
                            <strong>Editar el árbol</strong>
                            <span>Mantenlo presionado para detener la cámara y usar los controles de los nodos.</span>
                        </div>
                    </div>
                </div>

                <div className="mock-notice">
                    <Info size={16} /> Estos atajos se conectarán con la cámara 3D.
                </div>
            </div>
        </div>
    );
}
