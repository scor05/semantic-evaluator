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
    parseExpression,
    serializeSyntaxTree,
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
    const [formula, setFormula] = useState("∀x(P(x) → ∃y Q(x,y))");
    const [syntaxTree, setSyntaxTree] = useState<SyntaxNode | null>(() =>
        parseExpression(formula, {
            functions: functions.map(({ name }) => name),
            predicates: predicates.map(({ name }) => name),
        })
    );
    const [renderedFormula, setRenderedFormula] = useState(formula);
    const [functionOutputs, setFunctionOutputs] = useState<Record<string, string>>({});
    const [predicateTuples, setPredicateTuples] = useState<Record<string, string[]>>({
        P: ["(1, 0)", "(2, 0)"],
        Q: ["1", "0"],
    });
    const [environmentValue, setEnvironmentValue] = useState("1");
    const [hasFreeVariables, setHasFreeVariables] = useState(false);
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

    const setEditModeLock = (locked: boolean) => {
        editModeLockedRef.current = locked;
        setEditModeLocked(locked);
    };

    const selectNode = (nodeId: string | null) => {
        setSelectedNode(nodeId);
        if (!nodeId) setEditModeLock(false);
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
        setSyntaxTree(parseExpression(nextFormula, {
            functions: functions.map(({ name }) => name.trim()).filter(Boolean),
            predicates: predicates.map(({ name }) => name.trim()).filter(Boolean),
        }));
        setSelectedNode(null);
        setRenderedFormula(nextFormula);
        setDemonstrationResult(true);
        setToast("Vista actualizada. El motor semántico se conectará después.");
    };

    const updateTree = (tree: SyntaxNode) => {
        const nextFormula = serializeSyntaxTree(tree);
        setSyntaxTree(tree);
        setFormula(nextFormula);
        setRenderedFormula(nextFormula);
        setDemonstrationResult(null);
    };

    return (
        <main className={`app-shell ${drawerOpen ? "drawer-is-open" : ""}`}>
            <Workspace
                editMode={editMode}
                formula={renderedFormula}
                functionSymbols={functions.map(({ name }) => name.trim()).filter(Boolean)}
                onOpenEvidence={() => setEvidenceOpen(true)}
                onOpenHelp={() => setHelpOpen(true)}
                onEditModeLockChange={setEditModeLock}
                onSelectNode={selectNode}
                onTreeChange={updateTree}
                predicateSymbols={predicates.map(({ name }) => name.trim()).filter(Boolean)}
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
                    environmentValue={environmentValue}
                    functionOutputs={functionOutputs}
                    functions={functionInterpretations}
                    hasFreeVariables={hasFreeVariables}
                    onAddPredicateTuple={(predicate) =>
                        setPredicateTuples((current) => ({
                            ...current,
                            [predicate.name]: [
                                ...(current[predicate.name] ?? []),
                                predicate.arity > 1 ? "(…, …)" : "…",
                            ],
                        }))
                    }
                    onEnvironmentChange={setEnvironmentValue}
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
                    onToggleFreeVariables={() => setHasFreeVariables((current) => !current)}
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
