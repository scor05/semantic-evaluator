import type { DemonstrationResult } from "../../types/logic";
import type { SyntaxNode } from "../../domain/syntaxTree";
import { InteractionHint } from "./InteractionHint";
import { ResultButton } from "./ResultButton";
import { SyntaxTree } from "./SyntaxTree";
import { WorkspaceHeader } from "./WorkspaceHeader";
import "./workspace-controls.css";
import "./workspace-shell.css";

type WorkspaceProps = {
    formula: string;
    tree: SyntaxNode | null;
    editMode: boolean;
    environmentMissing: boolean;
    invalidDomainSymbols: string[];
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
    formula,
    tree,
    editMode,
    environmentMissing,
    invalidDomainSymbols,
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
                    environmentMissing={environmentMissing}
                    invalidDomainSymbols={invalidDomainSymbols}
                    onOpen={onOpenEvidence}
                    result={result}
                />
            </div>
        </section>
    );
}
