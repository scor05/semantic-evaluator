import type { DemonstrationResult, InterpretationError } from "../../types/logic";
import type { SyntaxNode } from "../../domain/syntaxTree";
import type { FormulaValidation } from "../../domain/validation";
import { InteractionHint } from "./InteractionHint";
import { ResultButton } from "./ResultButton";
import { SyntaxTree } from "./SyntaxTree";
import { WorkspaceHeader } from "./WorkspaceHeader";
import "./workspace-controls.css";
import "./workspace-shell.css";

type WorkspaceProps = {
    formula: string;
    tree: SyntaxNode | null;
    treeIsStale: boolean;
    errorNodeIds: string[];
    validation: FormulaValidation;
    editMode: boolean;
    environmentMissing: boolean;
    interpretationErrors: InterpretationError[];
    freeVariables: string[];
    functionSymbols: string[];
    predicateSymbols: string[];
    selectedNode: string | null;
    result: DemonstrationResult;
    onOpenHelp: () => void;
    onOpenEvidence: () => void;
    onOpenValidation: () => void;
    onSelectNode: (nodeId: string | null) => void;
    onTreeChange: (tree: SyntaxNode) => void;
};

export function Workspace({
    formula,
    tree,
    treeIsStale,
    errorNodeIds,
    validation,
    editMode,
    environmentMissing,
    interpretationErrors,
    freeVariables,
    functionSymbols,
    predicateSymbols,
    selectedNode,
    result,
    onOpenHelp,
    onOpenEvidence,
    onOpenValidation,
    onSelectNode,
    onTreeChange,
}: WorkspaceProps) {
    return (
        <section className="workspace" aria-label="Vista del árbol sintáctico">
            <WorkspaceHeader
                formula={formula}
                freeVariables={freeVariables}
                interpretationErrors={interpretationErrors}
                onOpenHelp={onOpenHelp}
                onOpenValidation={onOpenValidation}
                validation={validation}
            />
            <SyntaxTree
                editMode={editMode}
                errorNodeIds={errorNodeIds}
                functionSymbols={functionSymbols}
                onSelectNode={onSelectNode}
                onTreeChange={onTreeChange}
                predicateSymbols={predicateSymbols}
                selectedNode={selectedNode}
                stale={treeIsStale}
                tree={tree}
            />
            <div className="workspace-bottom-bar">
                <InteractionHint editMode={editMode} />
                <ResultButton
                    environmentMissing={environmentMissing}
                    interpretationErrors={interpretationErrors}
                    onOpen={onOpenEvidence}
                    result={result}
                    validation={validation}
                />
            </div>
        </section>
    );
}
