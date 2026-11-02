import { MousePointer2, Rotate3D } from "lucide-react";
import "../../styles/shared-controls.css";
import "./workspace-controls.css";

type InteractionHintProps = {
    editMode: boolean;
};

export function InteractionHint({ editMode }: InteractionHintProps) {
    return (
        <div className={`interaction-hint ${editMode ? "active" : ""}`}>
            {editMode ? <MousePointer2 size={25} /> : <Rotate3D size={25} />}
            <div>
                <strong>{editMode ? "Modo edición activo" : "Explora el árbol"}</strong>
                <span>
                    {editMode
                        ? "Haz clic en un control para modificar la estructura."
                        : "Arrastra para orbitar · rueda para acercar · Ctrl para editar"}
                </span>
            </div>
            <kbd>Ctrl</kbd>
        </div>
    );
}
