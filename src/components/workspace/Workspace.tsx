import type { DemonstrationResult } from "../../types/logic";
import { InteractionHint } from "./InteractionHint";
import { ResultButton } from "./ResultButton";
import { SyntaxTree } from "./SyntaxTree";
import { WorkspaceHeader } from "./WorkspaceHeader";
import "./workspace-controls.css";
import "./workspace-shell.css";

type WorkspaceProps = {
    formula: string;
    editMode: boolean;
    selectedNode: string | null;
    result: DemonstrationResult;
    onOpenHelp: () => void;
    onOpenEvidence: () => void;
    onSelectNode: (nodeId: string) => void;
    onFeedback: (message: string) => void;
};

export function Workspace({
    formula,
    editMode,
    selectedNode,
    result,
    onOpenHelp,
    onOpenEvidence,
    onSelectNode,
    onFeedback,
}: WorkspaceProps) {
    return (
        <section className="workspace" aria-label="Vista del árbol sintáctico">
            <WorkspaceHeader formula={formula} onOpenHelp={onOpenHelp} />
            <SyntaxTree
                editMode={editMode}
                formula={formula}
                onFeedback={onFeedback}
                onSelectNode={onSelectNode}
                selectedNode={selectedNode}
            />
            <InteractionHint editMode={editMode} />
            <ResultButton onOpen={onOpenEvidence} result={result} />
        </section>
    );
}
