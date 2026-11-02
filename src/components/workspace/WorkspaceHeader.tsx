import { CircleHelp } from "lucide-react";
import "../../styles/shared-controls.css";
import "./workspace-shell.css";

type WorkspaceHeaderProps = {
    formula: string;
    onOpenHelp: () => void;
};

export function WorkspaceHeader({ formula, onOpenHelp }: WorkspaceHeaderProps) {
    return (
        <header className="workspace-header">
            <div className="scene-title">
                <span className="eyebrow">Árbol sintáctico</span>
                <h1>{formula || "Tu fórmula aparecerá aquí"}</h1>
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
