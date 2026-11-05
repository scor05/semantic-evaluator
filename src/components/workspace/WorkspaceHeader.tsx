import { CircleHelp } from "lucide-react";
import type { SyntaxArityError } from "../../domain/syntaxTree";
import type { InterpretationError } from "../../types/logic";
import "../../styles/shared-controls.css";
import "./workspace-shell.css";

type WorkspaceHeaderProps = {
    arityErrors: SyntaxArityError[];
    formula: string;
    freeVariables: string[];
    invalidDomainSymbols: string[];
    interpretationErrors: InterpretationError[];
    onOpenHelp: () => void;
};

export function WorkspaceHeader({
    arityErrors,
    formula,
    freeVariables,
    invalidDomainSymbols,
    interpretationErrors,
    onOpenHelp,
}: WorkspaceHeaderProps) {
    const isOpen = freeVariables.length > 0;
    const hasInvalidSymbol = invalidDomainSymbols.length > 0;
    const firstArityError = arityErrors[0];
    const hasInterpretationError = interpretationErrors.length > 0;
    const hasInvalidInterpretation = interpretationErrors.some(
        ({ reason }) => reason === "invalid",
    );
    const hasFormulaError = hasInvalidSymbol || Boolean(firstArityError) || hasInterpretationError;
    const status = hasFormulaError ? "invalid" : isOpen ? "open" : "closed";

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
                            : firstArityError
                                ? `Aridad inválida · ${firstArityError.symbol} tiene ${firstArityError.actual} de ${firstArityError.expected} argumentos`
                            : hasInterpretationError
                                ? `${hasInvalidInterpretation ? "Interpretación inválida" : "Interpretación faltante"} · ${interpretationErrors.map(({ symbol }) => symbol).join(", ")}`
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
