import { CircleHelp } from "lucide-react";
import "../../styles/shared-controls.css";
import "./workspace-shell.css";

type WorkspaceHeaderProps = {
    formula: string;
    freeVariables: string[];
    invalidDomainSymbols: string[];
    onOpenHelp: () => void;
};

export function WorkspaceHeader({
    formula,
    freeVariables,
    invalidDomainSymbols,
    onOpenHelp,
}: WorkspaceHeaderProps) {
    const isOpen = freeVariables.length > 0;
    const hasInvalidSymbol = invalidDomainSymbols.length > 0;
    const status = hasInvalidSymbol ? "invalid" : isOpen ? "open" : "closed";

    return (
        <header className="workspace-header">
            <div className="scene-title">
                <span className="eyebrow">Árbol sintáctico</span>
                <h1>{formula || "Tu fórmula aparecerá aquí"}</h1>
                {formula && (
                    <p className={`formula-status is-${status}`}>
                        <span className="status-dot" />
                        {hasInvalidSymbol
                            ? `Símbolo no reconocido · ${invalidDomainSymbols.join(", ")}`
                            : isOpen
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
