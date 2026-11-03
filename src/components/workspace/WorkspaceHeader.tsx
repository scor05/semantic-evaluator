import { CircleHelp } from "lucide-react";
import "../../styles/shared-controls.css";
import "./workspace-shell.css";

type WorkspaceHeaderProps = {
    formula: string;
    freeVariables: string[];
    onOpenHelp: () => void;
};

export function WorkspaceHeader({ formula, freeVariables, onOpenHelp }: WorkspaceHeaderProps) {
    const isOpen = freeVariables.length > 0;

    return (
        <header className="workspace-header">
            <div className="scene-title">
                <span className="eyebrow">Árbol sintáctico</span>
                <h1>{formula || "Tu fórmula aparecerá aquí"}</h1>
                {formula && (
                    <p className={`formula-status is-${isOpen ? "open" : "closed"}`}>
                        <span className="status-dot" />
                        {isOpen
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
