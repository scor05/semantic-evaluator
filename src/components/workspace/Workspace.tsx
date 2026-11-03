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
            <WorkspaceHeader formula={formula} onOpenHelp={onOpenHelp} />
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
            <InteractionHint editMode={editMode} />
            <ResultButton onOpen={onOpenEvidence} result={result} />
        </section>
    );
}
