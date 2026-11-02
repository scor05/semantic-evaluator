import { Minus, Plus } from "lucide-react";
import { demoNodes } from "../../data/demo";
import "./syntax-tree.css";

type SyntaxTreeProps = {
    formula: string;
    editMode: boolean;
    selectedNode: string | null;
    onSelectNode: (nodeId: string) => void;
    onFeedback: (message: string) => void;
};

const paletteSymbols = ["¬", "∧", "∨", "→", "∀", "∃"];

export function SyntaxTree({
    formula,
    editMode,
    selectedNode,
    onSelectNode,
    onFeedback,
}: SyntaxTreeProps) {
    return (
        <div className={`tree-scene ${editMode ? "is-editing" : ""}`}>
            {formula ? (
                <>
                    <svg
                        aria-hidden="true"
                        className="tree-edges"
                        preserveAspectRatio="none"
                        viewBox="0 0 100 100"
                    >
                        <defs>
                            <linearGradient id="edgeGradient" x1="0" x2="1">
                                <stop offset="0" stopColor="#77e0bd" stopOpacity=".25" />
                                <stop offset=".5" stopColor="#a7ffe4" stopOpacity=".85" />
                                <stop offset="1" stopColor="#77e0bd" stopOpacity=".25" />
                            </linearGradient>
                        </defs>
                        <line x1="50" y1="15" x2="50" y2="31" />
                        <line x1="48" y1="38" x2="29" y2="57" />
                        <line x1="52" y1="38" x2="71" y2="57" />
                        <line x1="73" y1="64" x2="73" y2="81" />
                    </svg>
                    {demoNodes.map((node) => (
                        <div
                            className={`tree-node-wrap node-${node.kind}`}
                            key={node.id}
                            style={{ left: `${node.x}%`, top: `${node.y}%` }}
                        >
                            {editMode && (
                                <button
                                    aria-label={`Agregar arriba de ${node.label}`}
                                    className="node-handle add-handle above"
                                    onClick={() => onSelectNode(node.id)}
                                    type="button"
                                >
                                    <Plus size={13} />
                                </button>
                            )}
                            <button
                                className={`tree-node ${selectedNode === node.id ? "selected" : ""}`}
                                onClick={() => editMode && onSelectNode(node.id)}
                                type="button"
                            >
                                <span>{node.label}</span>
                            </button>
                            {editMode && (
                                <>
                                    <button
                                        aria-label={`Eliminar ${node.label}`}
                                        className="node-handle delete-handle"
                                        onClick={() => onFeedback("La eliminación se conectará al AST.")}
                                        type="button"
                                    >
                                        <Minus size={13} />
                                    </button>
                                    <button
                                        aria-label={`Agregar debajo de ${node.label}`}
                                        className="node-handle add-handle below"
                                        onClick={() => onSelectNode(node.id)}
                                        type="button"
                                    >
                                        <Plus size={13} />
                                    </button>
                                </>
                            )}
                            {selectedNode === node.id && (
                                <div className="node-palette">
                                    <span>Agregar</span>
                                    <div>
                                        {paletteSymbols.map((symbol) => (
                                            <button
                                                key={symbol}
                                                onClick={() =>
                                                    onFeedback(
                                                        `${symbol} se añadirá cuando conectemos el editor estructural.`,
                                                    )
                                                }
                                                type="button"
                                            >
                                                {symbol}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </>
            ) : (
                <div className="empty-scene">
                    <div className="empty-glyph">φ</div>
                    <h2>Construye una fórmula para ver su árbol sintáctico</h2>
                </div>
            )}
        </div>
    );
}
