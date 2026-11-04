import { useEffect, useMemo, useRef, useState } from "react";
import { EvidenceDialog } from "./components/dialogs/EvidenceDialog";
import { HelpDialog } from "./components/dialogs/HelpDialog";
import { FormulaSection } from "./components/parameters/FormulaSection";
import { InterpretationSection } from "./components/parameters/InterpretationSection";
import { LanguageSection } from "./components/parameters/LanguageSection";
import { ParameterDrawer } from "./components/parameters/ParameterDrawer";
import { Toast } from "./components/ui/Toast";
import { Workspace } from "./components/workspace/Workspace";
import {
    createDefaultFunctionOutputs,
    getInterpretationErrors,
} from "./domain/interpretation";
import {
    classifySyntaxSymbol,
    clearSyntaxNodeSubstitution,
    findSyntaxNode,
    getEnvironmentNodeIds,
    getFreeVariables,
    getSyntaxArityErrors,
    getSubstitutionValues,
    getSubstitutedVariables,
    getSyntaxNodes,
    inferSyntaxNodeKind,
    isVariableLabel,
    parseExpression,
    serializeSyntaxTree,
    substituteFreeVariable,
    trackSyntaxNodeSubstitution,
    type SyntaxNode,
} from "./domain/syntaxTree";
import type {
    DemonstrationResult,
    FunctionDefinition,
    PredicateDefinition,
} from "./types/logic";
import { cartesianPower } from "./utils/cartesianPower";

function App() {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [domain, setDomain] = useState(["0", "1", "2"]);
    const [domainDraft, setDomainDraft] = useState("");
    const [functions, setFunctions] = useState<FunctionDefinition[]>([
        { id: 1, name: "f", arity: 2 },
        { id: 2, name: "g", arity: 1 },
    ]);
    const [predicates, setPredicates] = useState<PredicateDefinition[]>([
        { id: 1, name: "P", arity: 2 },
        { id: 2, name: "Q", arity: 1 },
    ]);
    const [formula, setFormula] = useState("∀x(P(x,y) → ∃y Q(y))");
    const [syntaxTree, setSyntaxTree] = useState<SyntaxNode | null>(() =>
        parseExpression(formula, {
            functions: functions.map(({ name }) => name),
            predicates: predicates.map(({ name }) => name),
            values: domain,
        })
    );
    const [renderedFormula, setRenderedFormula] = useState(formula);
    const [functionOutputs, setFunctionOutputs] = useState<Record<string, string>>(() =>
        createDefaultFunctionOutputs(domain, functions)
    );
    const [predicateTuples, setPredicateTuples] = useState<Record<string, string[]>>({
        P: ["(1, 0)", "(2, 0)"],
        Q: ["1", "0"],
    });
    const [environmentValues, setEnvironmentValues] = useState<Record<string, string>>({});
    const [editedNodeSymbols, setEditedNodeSymbols] =
        useState<Record<string, string>>({});
    const [controlEditMode, setControlEditMode] = useState(false);
    const [editModeLocked, setEditModeLocked] = useState(false);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const [evidenceOpen, setEvidenceOpen] = useState(false);
    const [demonstrationResult, setDemonstrationResult] =
        useState<DemonstrationResult>(null);
    const [toast, setToast] = useState<string | null>(null);
    const formulaInputRef = useRef<HTMLInputElement>(null);
    const editModeLockedRef = useRef(false);
    const nextId = useRef(10);
    const editMode = controlEditMode || editModeLocked;
    const functionSymbols = useMemo(
        () => functions.map(({ name }) => name.trim()).filter(Boolean),
        [functions],
    );
    const predicateSymbols = useMemo(
        () => predicates.map(({ name }) => name.trim()).filter(Boolean),
        [predicates],
    );
    const freeVariables = useMemo(
        () => syntaxTree ? getFreeVariables(syntaxTree) : [],
        [syntaxTree],
    );
    const environmentVariables = useMemo(() => {
        if (!syntaxTree) return [];
        return [...new Set([...freeVariables, ...getSubstitutedVariables(syntaxTree)])];
    }, [freeVariables, syntaxTree]);
    const environmentMissing = freeVariables.some(
        (variable) => !environmentValues[variable]?.trim(),
    );
    const invalidDomainSymbols = useMemo(
        () => [...new Set(Object.values(editedNodeSymbols))].filter(
            (symbol) => !classifySyntaxSymbol(symbol, {
                values: domain,
                predicates: predicateSymbols,
                functions: functionSymbols,
            }),
        ),
        [domain, editedNodeSymbols, functionSymbols, predicateSymbols],
    );
    const arityErrors = useMemo(
        () => syntaxTree ? getSyntaxArityErrors(syntaxTree, { functions, predicates }) : [],
        [functions, predicates, syntaxTree],
    );

    const setEditModeLock = (locked: boolean) => {
        editModeLockedRef.current = locked;
        setEditModeLocked(locked);
    };

    const selectNode = (nodeId: string | null) => {
        setSelectedNode(nodeId);
        setEditModeLock(nodeId !== null);
    };

    const functionInterpretations = useMemo(
        () =>
            functions.map((definition) => ({
                definition,
                inputs: cartesianPower(domain, definition.arity),
                inputCount: definition.arity === 0 ? 1 : domain.length ** definition.arity,
            })),
        [domain, functions],
    );
    const interpretationErrors = useMemo(() => {
        return getInterpretationErrors({
            domain,
            functions,
            predicates,
            functionOutputs,
            predicateTuples,
        });
    }, [domain, functionOutputs, functions, predicateTuples, predicates]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Control") setControlEditMode(true);
            if (event.key === "Escape") {
                setHelpOpen(false);
                setEvidenceOpen(false);
            }
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key === "Control") {
                setControlEditMode(false);
                if (!editModeLockedRef.current) setSelectedNode(null);
            }
        };
        const resetEditMode = () => {
            setControlEditMode(false);
            if (!editModeLockedRef.current) setSelectedNode(null);
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", resetEditMode);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", resetEditMode);
        };
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timeout = window.setTimeout(() => setToast(null), 2600);
        return () => window.clearTimeout(timeout);
    }, [toast]);

    const updateFunction = (
        id: number,
        field: "name" | "arity",
        value: string | number,
    ) => {
        setFunctions((current) =>
            current.map((definition) =>
                definition.id === id
                    ? {
                        ...definition,
                        [field]:
                            field === "name"
                                ? value
                                : Math.max(0, Math.min(4, Number(value) || 0)),
                    }
                    : definition,
            ),
        );
    };

    const updatePredicate = (
        id: number,
        field: "name" | "arity",
        value: string | number,
    ) => {
        setPredicates((current) =>
            current.map((definition) =>
                definition.id === id
                    ? {
                        ...definition,
                        [field]:
                            field === "arity"
                                ? Math.max(0, Math.min(4, Number(value) || 0))
                                : value,
                    }
                    : definition,
            ),
        );
    };

    const insertOperator = (operator: string) => {
        const input = formulaInputRef.current;
        const start = input?.selectionStart ?? formula.length;
        const end = input?.selectionEnd ?? formula.length;
        setFormula(`${formula.slice(0, start)}${operator}${formula.slice(end)}`);
        requestAnimationFrame(() => {
            input?.focus();
            input?.setSelectionRange(start + operator.length, start + operator.length);
        });
    };

    const addDomainValue = () => {
        const value = domainDraft.trim();
        if (!value || domain.includes(value)) return;
        setDomain((current) => [...current, value]);
        setDomainDraft("");
    };

    const evaluateMock = () => {
        if (!formula.trim()) {
            setToast("Escribe una fórmula antes de visualizarla.");
            return;
        }
        const nextFormula = formula.trim();
        const nextTree = parseExpression(nextFormula, {
            functions: functions.map(({ name }) => name.trim()).filter(Boolean),
            predicates: predicates.map(({ name }) => name.trim()).filter(Boolean),
            values: domain,
        });
        setSyntaxTree(nextTree);
        setEnvironmentValues({});
        setEditedNodeSymbols({});
        setSelectedNode(null);
        setRenderedFormula(nextFormula);
        setDemonstrationResult(true);
        setToast("Vista actualizada. El motor semántico se conectará después.");
    };

    const commitTree = (tree: SyntaxNode) => {
        const nextFormula = serializeSyntaxTree(tree);
        setSyntaxTree(tree);
        setFormula(nextFormula);
        setRenderedFormula(nextFormula);
        setDemonstrationResult(null);
    };

    const updateTree = (tree: SyntaxNode) => {
        let reconciledTree = tree;
        const previousEnvironmentNodeIds = syntaxTree
            ? getEnvironmentNodeIds(syntaxTree)
            : [];

        for (const nodeId of previousEnvironmentNodeIds) {
            const previousNode = syntaxTree && findSyntaxNode(syntaxTree, nodeId);
            const nextNode = findSyntaxNode(reconciledTree, nodeId);
            if (!previousNode || !nextNode || previousNode.label === nextNode.label) {
                continue;
            }

            const role = classifySyntaxSymbol(nextNode.label, {
                values: domain,
                predicates: predicateSymbols,
                functions: functionSymbols,
            });
            if (
                nextNode.substitutedFor
                && (role === "predicate" || role === "function" || role === "logical")
            ) {
                reconciledTree = clearSyntaxNodeSubstitution(
                    reconciledTree,
                    nodeId,
                    role === "predicate"
                        ? "predicate"
                        : role === "function"
                            ? "function"
                            : inferSyntaxNodeKind(nextNode.label),
                );
            } else if (
                !isVariableLabel(nextNode.label)
                && !nextNode.substitutedFor
                && (role === "value" || role === null)
            ) {
                reconciledTree = trackSyntaxNodeSubstitution(
                    reconciledTree,
                    nodeId,
                    previousNode.substitutedFor ?? previousNode.label,
                );
            }
        }

        const substitutions = getSubstitutionValues(reconciledTree);
        const nextEnvironmentValues: Record<string, string> = {};

        for (const [variable, values] of Object.entries(substitutions)) {
            const previousValue = environmentValues[variable];
            const editedValue =
                values.find((value) => value !== previousValue) ??
                values[0] ??
                previousValue;

            if (!editedValue) continue;
            reconciledTree = substituteFreeVariable(
                reconciledTree,
                variable,
                editedValue,
            );
            nextEnvironmentValues[variable] = editedValue;
        }

        for (const variable of getFreeVariables(reconciledTree)) {
            nextEnvironmentValues[variable] = "";
        }

        const previousNodes = new Map(
            syntaxTree
                ? getSyntaxNodes(syntaxTree).map((node) => [node.id, node] as const)
                : [],
        );
        setEditedNodeSymbols((current) => {
            const next: Record<string, string> = {};

            for (const nodeId of Object.keys(current)) {
                const node = findSyntaxNode(reconciledTree, nodeId);
                if (node) next[nodeId] = node.label;
            }

            for (const node of getSyntaxNodes(reconciledTree)) {
                const previousNode = previousNodes.get(node.id);
                if (!previousNode || previousNode.label !== node.label) {
                    next[node.id] = node.label;
                }
            }

            return next;
        });

        commitTree(reconciledTree);
        setEnvironmentValues(nextEnvironmentValues);
    };

    const updateEnvironment = (variable: string, value: string) => {
        setEnvironmentValues((current) => ({ ...current, [variable]: value }));
        if (!syntaxTree) return;
        const nextTree = substituteFreeVariable(syntaxTree, variable, value);
        setEditedNodeSymbols((current) =>
            Object.fromEntries(
                Object.keys(current).flatMap((nodeId) => {
                    const node = findSyntaxNode(nextTree, nodeId);
                    return node ? [[nodeId, node.label]] : [];
                }),
            ),
        );
        commitTree(nextTree);
    };

    return (
        <main className={`app-shell ${drawerOpen ? "drawer-is-open" : ""}`}>
            <Workspace
                arityErrors={arityErrors}
                editMode={editMode}
                invalidDomainSymbols={invalidDomainSymbols}
                interpretationErrors={interpretationErrors}
                environmentMissing={environmentMissing}
                formula={renderedFormula}
                freeVariables={freeVariables}
                functionSymbols={functionSymbols}
                onOpenEvidence={() => setEvidenceOpen(true)}
                onOpenHelp={() => setHelpOpen(true)}
                onSelectNode={selectNode}
                onTreeChange={updateTree}
                predicateSymbols={predicateSymbols}
                result={demonstrationResult}
                selectedNode={selectedNode}
                tree={syntaxTree}
            />

            <ParameterDrawer
                onClear={() => {
                    setFormula("");
                    setRenderedFormula("");
                    setSyntaxTree(null);
                    setSelectedNode(null);
                    setEditModeLock(false);
                    setEnvironmentValues({});
                    setEditedNodeSymbols({});
                    setDemonstrationResult(null);
                }}
                onEvaluate={evaluateMock}
                onToggle={() => setDrawerOpen((current) => !current)}
                open={drawerOpen}
            >
                <LanguageSection
                    domain={domain}
                    domainDraft={domainDraft}
                    functions={functions}
                    onAddDomainValue={addDomainValue}
                    onAddFunction={() =>
                        setFunctions((current) => [
                            ...current,
                            { id: nextId.current++, name: "h", arity: 1 },
                        ])
                    }
                    onAddPredicate={() =>
                        setPredicates((current) => [
                            ...current,
                            { id: nextId.current++, name: "R", arity: 1 },
                        ])
                    }
                    onDomainDraftChange={setDomainDraft}
                    onRemoveDomainValue={(value) =>
                        setDomain((current) => current.filter((item) => item !== value))
                    }
                    onRemoveFunction={(id) =>
                        setFunctions((current) =>
                            current.filter((definition) => definition.id !== id),
                        )
                    }
                    onRemovePredicate={(id) =>
                        setPredicates((current) =>
                            current.filter((definition) => definition.id !== id),
                        )
                    }
                    onUpdateFunction={updateFunction}
                    onUpdatePredicate={updatePredicate}
                    predicates={predicates}
                />

                <FormulaSection
                    formula={formula}
                    inputRef={formulaInputRef}
                    onFormulaChange={setFormula}
                    onInsertOperator={insertOperator}
                />

                <InterpretationSection
                    domain={domain}
                    environmentValues={environmentValues}
                    freeVariables={environmentVariables}
                    functionOutputs={functionOutputs}
                    functions={functionInterpretations}
                    onAddPredicateTuple={(predicate) =>
                        setPredicateTuples((current) => ({
                            ...current,
                            [predicate.name]: [
                                ...(current[predicate.name] ?? []),
                                predicate.arity > 1 ? "(…, …)" : "…",
                            ],
                        }))
                    }
                    onEnvironmentChange={updateEnvironment}
                    onFunctionOutputChange={(key, value) =>
                        setFunctionOutputs((current) => ({ ...current, [key]: value }))
                    }
                    onPredicateTupleChange={(name, index, value) =>
                        setPredicateTuples((current) => ({
                            ...current,
                            [name]: (current[name] ?? []).map((tuple, tupleIndex) =>
                                tupleIndex === index ? value : tuple,
                            ),
                        }))
                    }
                    onRemovePredicateTuple={(name, index) =>
                        setPredicateTuples((current) => ({
                            ...current,
                            [name]: (current[name] ?? []).filter(
                                (_, tupleIndex) => tupleIndex !== index,
                            ),
                        }))
                    }
                    predicates={predicates}
                    predicateTuples={predicateTuples}
                />
            </ParameterDrawer>

            {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
            {evidenceOpen && <EvidenceDialog onClose={() => setEvidenceOpen(false)} />}
            {toast && <Toast message={toast} />}
        </main>
    );
}

export default App;
