import type { DemonstrationResult, InterpretationError } from "../../types/logic";
import type { SyntaxArityError, SyntaxNode } from "../../domain/syntaxTree";
import { InteractionHint } from "./InteractionHint";
import { ResultButton } from "./ResultButton";
import { SyntaxTree } from "./SyntaxTree";
import { WorkspaceHeader } from "./WorkspaceHeader";
import "./workspace-controls.css";
import "./workspace-shell.css";

type WorkspaceProps = {
    arityErrors: SyntaxArityError[];
    formula: string;
    tree: SyntaxNode | null;
    editMode: boolean;
    environmentMissing: boolean;
    invalidDomainSymbols: string[];
    interpretationErrors: InterpretationError[];
    freeVariables: string[];
    functionSymbols: string[];
    predicateSymbols: string[];
    selectedNode: string | null;
    result: DemonstrationResult;
    onOpenHelp: () => void;
    onOpenEvidence: () => void;
    onEditModeLockChange: (locked: boolean) => void;
    onSelectNode: (nodeId: string | null) => void;
    onTreeChange: (tree: SyntaxNode) => void;
};

export function Workspace({
    arityErrors,
    formula,
    tree,
    editMode,
    environmentMissing,
    invalidDomainSymbols,
    interpretationErrors,
    freeVariables,
    functionSymbols,
    predicateSymbols,
    selectedNode,
    result,
    onOpenHelp,
    onOpenEvidence,
    onEditModeLockChange,
    onSelectNode,
    onTreeChange,
}: WorkspaceProps) {
    return (
        <section className="workspace" aria-label="Vista del árbol sintáctico">
            <WorkspaceHeader
                formula={formula}
                freeVariables={freeVariables}
                invalidDomainSymbols={invalidDomainSymbols}
                arityErrors={arityErrors}
                interpretationErrors={interpretationErrors}
                onOpenHelp={onOpenHelp}
            />
            <SyntaxTree
                editMode={editMode}
                functionSymbols={functionSymbols}
                onEditModeLockChange={onEditModeLockChange}
                onSelectNode={onSelectNode}
                onTreeChange={onTreeChange}
                predicateSymbols={predicateSymbols}
                selectedNode={selectedNode}
                tree={tree}
            />
            <div className="workspace-bottom-bar">
                <InteractionHint editMode={editMode} />
                <ResultButton
                    arityErrors={arityErrors}
                    environmentMissing={environmentMissing}
                    invalidDomainSymbols={invalidDomainSymbols}
                    interpretationErrors={interpretationErrors}
                    onOpen={onOpenEvidence}
                    result={result}
                />
            </div>
        </section>
    );
}
