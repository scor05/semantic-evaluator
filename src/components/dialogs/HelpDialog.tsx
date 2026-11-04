import { Info, Keyboard, X } from "lucide-react";
import "../../styles/shared-controls.css";
import "./dialogs.css";

type HelpDialogProps = {
    onClose: () => void;
};

const controls = [
    { keys: ["Q", "E"], title: "Acercar y alejar", description: "Mantén presionado para ajustar la distancia." },
    { keys: ["A", "D"], title: "Movimiento horizontal", description: "Mantén presionado para girar horizontalmente respecto a la cámara." },
    { keys: ["W", "S"], title: "Movimiento vertical", description: "Mantén presionado para girar verticalmente respecto a la cámara." },
    { keys: ["Z", "X"], title: "Inclinación", description: "Mantén presionado para girar respecto al eje de visión de la cámara." },
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
                        <div className="key-group arrow-keys" aria-label="Flechas verticales">
                            <kbd>↑</kbd><kbd>↓</kbd>
                        </div>
                        <div>
                            <strong>Desplazar cámara verticalmente</strong>
                            <span>Mueve la cámara y su objetivo hacia arriba o abajo. Shift acelera todos los controles.</span>
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
                            <span>Mantenlo presionado para seleccionar un nodo. La edición queda activa hasta hacer clic en un espacio vacío.</span>
                        </div>
                    </div>
                </div>

                <div className="mock-notice">
                    <Info size={16} /> También puedes arrastrar para orbitar y usar la rueda para acercarte.
                </div>
            </div>
        </div>
    );
}
