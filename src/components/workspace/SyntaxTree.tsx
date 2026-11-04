import { Plus, Trash2, WrapText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
    addSyntaxChild,
    findSyntaxNode,
    inferSyntaxNodeKind,
    removeSyntaxNode,
    renameSyntaxNode,
    wrapSyntaxNode,
    type SyntaxNode,
    type SyntaxNodeKind,
} from "../../domain/syntaxTree";
import type {
    SyntaxTreeRenderer as SyntaxTreeRendererInstance,
    TreeEditAction,
} from "./three/SyntaxTreeRenderer";
import "./syntax-tree.css";

type SyntaxTreeProps = {
    tree: SyntaxNode | null;
    editMode: boolean;
    functionSymbols: string[];
    predicateSymbols: string[];
    selectedNode: string | null;
    onSelectNode: (nodeId: string | null) => void;
    onTreeChange: (tree: SyntaxNode) => void;
};

type PendingAddition = {
    action: Exclude<TreeEditAction, "remove">;
    nodeId: string;
};

const connectiveSymbols = ["¬", "∧", "∨", "→", "↔"];
const quantifierSymbols = ["∀x", "∃x"];

export function SyntaxTree({
    tree,
    editMode,
    functionSymbols,
    predicateSymbols,
    selectedNode,
    onSelectNode,
    onTreeChange,
}: SyntaxTreeProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<SyntaxTreeRendererInstance | null>(null);
    const treeRef = useRef(tree);
    const interactionRef = useRef({ editMode, selectedNode });
    const callbacksRef = useRef({ onSelectNode, onTreeChange });
    const editorRef = useRef<HTMLDivElement>(null);
    const skipRenameCommitRef = useRef(false);
    const [rendererError, setRendererError] = useState<string | null>(null);
    const [pendingAddition, setPendingAddition] = useState<PendingAddition | null>(null);
    const [additionDraft, setAdditionDraft] = useState("");
    const [renameDraft, setRenameDraft] = useState("");

    treeRef.current = tree;
    interactionRef.current = { editMode, selectedNode };
    callbacksRef.current = { onSelectNode, onTreeChange };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let cancelled = false;
        void import("./three/SyntaxTreeRenderer")
            .then(({ SyntaxTreeRenderer }) => {
                if (cancelled) return;
                const renderer = new SyntaxTreeRenderer(container, {
                    onSelectNode: (nodeId) => callbacksRef.current.onSelectNode(nodeId),
                    onEditNode: (action, nodeId) => {
                        const currentTree = treeRef.current;
                        if (!currentTree) return;
                        if (action === "remove") {
                            callbacksRef.current.onTreeChange(removeSyntaxNode(currentTree, nodeId));
                            callbacksRef.current.onSelectNode(null);
                            return;
                        }
                        setAdditionDraft(action === "wrap" ? "¬" : "x");
                        setPendingAddition({ action, nodeId });
                    },
                });
                rendererRef.current = renderer;
                if (treeRef.current) renderer.setTree(treeRef.current);
                const interaction = interactionRef.current;
                renderer.setInteraction(interaction.editMode, interaction.selectedNode);
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setRendererError(
                        error instanceof Error ? error.message : "No se pudo iniciar WebGL.",
                    );
                }
            });

        return () => {
            cancelled = true;
            rendererRef.current?.dispose();
            rendererRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (tree) rendererRef.current?.setTree(tree);
        else rendererRef.current?.clearTree();
    }, [tree]);

    useEffect(() => {
        rendererRef.current?.setInteraction(editMode, selectedNode);
    }, [editMode, selectedNode]);

    useEffect(() => {
        if (!pendingAddition) return;
        const cancelOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setPendingAddition(null);
        };
        window.addEventListener("keydown", cancelOnEscape);
        return () => window.removeEventListener("keydown", cancelOnEscape);
    }, [pendingAddition]);

    const selected = tree && selectedNode ? findSyntaxNode(tree, selectedNode) : null;

    useEffect(() => {
        setRenameDraft(selected?.label ?? "");
    }, [selected?.id]);

    const commitRename = () => {
        if (!tree || !selected) return;
        const label = renameDraft.trim();
        if (!label) {
            setRenameDraft(selected.label);
            return;
        }
        if (label !== selected.label) {
            const kind = resolveSymbolKind(label, predicateSymbols, functionSymbols);
            onTreeChange(renameSyntaxNode(tree, selected.id, label, kind));
        }
        setRenameDraft(label);
    };

    const editTree = (action: TreeEditAction) => {
        if (!tree || !selectedNode) return;
        if (action === "remove") {
            onTreeChange(removeSyntaxNode(tree, selectedNode));
            onSelectNode(null);
            return;
        }
        setAdditionDraft(action === "wrap" ? "¬" : "x");
        setPendingAddition({ action, nodeId: selectedNode });
    };

    const confirmAddition = () => {
        const label = additionDraft.trim();
        if (!tree || !pendingAddition || !label) return;
        const kind = resolveSymbolKind(label, predicateSymbols, functionSymbols);
        const nextTree = applyTreeAddition(
            tree,
            pendingAddition.nodeId,
            pendingAddition.action,
            label,
            kind,
        );
        onTreeChange(nextTree);
        setPendingAddition(null);
    };

    return (
        <div className={`tree-scene ${editMode ? "is-editing" : ""}`}>
            <div className="syntax-tree-viewport" ref={containerRef} />

            {!tree && (
                <div className="empty-scene">
                    <div className="empty-glyph">φ</div>
                    <h2>Construye una fórmula para ver su árbol sintáctico</h2>
                </div>
            )}

            {rendererError && (
                <div className="renderer-error" role="alert">
                    <strong>No se pudo iniciar el renderizador 3D</strong>
                    <span>{rendererError}</span>
                </div>
            )}

            {editMode && selected && tree && (
                <div
                    className="tree-node-editor"
                    onBlurCapture={(event) => {
                        if (editorRef.current?.contains(event.relatedTarget as Node | null)) return;
                        if (skipRenameCommitRef.current) skipRenameCommitRef.current = false;
                        else commitRename();
                    }}
                    ref={editorRef}
                >
                    <span>Editando nodo</span>
                    <input
                        aria-label="Símbolo del nodo"
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.currentTarget.blur();
                            }
                            if (event.key === "Escape") {
                                event.stopPropagation();
                                skipRenameCommitRef.current = true;
                                setRenameDraft(selected.label);
                                event.currentTarget.blur();
                            }
                        }}
                        value={renameDraft}
                    />
                    <div className="node-editor-symbols" aria-label="Símbolos lógicos">
                        {[...quantifierSymbols, ...connectiveSymbols].map((symbol) => (
                            <button
                                aria-label={`Usar ${symbol}`}
                                className={renameDraft === symbol ? "is-selected" : ""}
                                key={symbol}
                                onClick={() => setRenameDraft(symbol)}
                                type="button"
                            >
                                {symbol}
                            </button>
                        ))}
                    </div>
                    <div className="node-editor-actions">
                        <button onClick={() => editTree("wrap")} type="button">
                            <WrapText size={14} /> Padre
                        </button>
                        <button onClick={() => editTree("add-child")} type="button">
                            <Plus size={14} /> Hijo
                        </button>
                        <button className="danger" onClick={() => editTree("remove")} type="button">
                            <Trash2 size={14} /> Eliminar
                        </button>
                    </div>
                </div>
            )}

            {pendingAddition && (
                <div className="node-addition-backdrop" role="presentation">
                    <form
                        aria-labelledby="node-addition-title"
                        aria-modal="true"
                        className="node-addition-dialog"
                        onSubmit={(event) => {
                            event.preventDefault();
                            confirmAddition();
                        }}
                        role="dialog"
                    >
                        <span className="eyebrow">
                            {pendingAddition.action === "wrap" ? "Nuevo nodo padre" : "Nuevo nodo hijo"}
                        </span>
                        <h2 id="node-addition-title">¿Qué símbolo quieres agregar?</h2>
                        <input
                            aria-label="Símbolo nuevo"
                            autoFocus
                            onChange={(event) => setAdditionDraft(event.target.value)}
                            value={additionDraft}
                        />
                        <div className="symbol-categories">
                            <SymbolCategory
                                activeSymbol={additionDraft}
                                label="Conectivos"
                                onSelect={setAdditionDraft}
                                symbols={connectiveSymbols}
                            />
                            <SymbolCategory
                                activeSymbol={additionDraft}
                                label="Cuantificadores"
                                onSelect={setAdditionDraft}
                                symbols={quantifierSymbols}
                            />
                            <SymbolCategory
                                activeSymbol={additionDraft}
                                label="Predicados"
                                onSelect={setAdditionDraft}
                                symbols={uniqueSymbols(predicateSymbols)}
                            />
                            <SymbolCategory
                                activeSymbol={additionDraft}
                                label="Funcionales"
                                onSelect={setAdditionDraft}
                                symbols={uniqueSymbols(functionSymbols)}
                            />
                        </div>
                        <div className="node-addition-actions">
                            <button onClick={() => setPendingAddition(null)} type="button">
                                Cancelar
                            </button>
                            <button className="confirm" disabled={!additionDraft.trim()} type="submit">
                                Agregar
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

function applyTreeAddition(
    tree: SyntaxNode,
    nodeId: string,
    action: Exclude<TreeEditAction, "remove">,
    label: string,
    kind: SyntaxNodeKind,
): SyntaxNode {
    if (action === "wrap") return wrapSyntaxNode(tree, nodeId, label, kind);
    return addSyntaxChild(tree, nodeId, label, kind);
}

type SymbolCategoryProps = {
    activeSymbol: string;
    label: string;
    symbols: string[];
    onSelect: (symbol: string) => void;
};

function SymbolCategory({ activeSymbol, label, symbols, onSelect }: SymbolCategoryProps) {
    return (
        <section className="symbol-category">
            <span>{label}</span>
            {symbols.length > 0 ? (
                <div className="symbol-suggestions" aria-label={label}>
                    {symbols.map((symbol) => (
                        <button
                            className={activeSymbol === symbol ? "is-selected" : ""}
                            key={symbol}
                            onClick={() => onSelect(symbol)}
                            type="button"
                        >
                            {symbol}
                        </button>
                    ))}
                </div>
            ) : (
                <small>Sin símbolos definidos</small>
            )}
        </section>
    );
}

function uniqueSymbols(symbols: string[]): string[] {
    return [...new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))];
}

function resolveSymbolKind(
    label: string,
    predicateSymbols: string[],
    functionSymbols: string[],
): SyntaxNodeKind {
    if (predicateSymbols.includes(label)) return "predicate";
    if (functionSymbols.includes(label)) return "function";
    return inferSyntaxNodeKind(label);
}
