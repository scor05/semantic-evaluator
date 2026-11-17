import { useEffect, useMemo, useRef, useState } from "react";
import { EvidenceDialog } from "./components/dialogs/EvidenceDialog";
import { HelpDialog } from "./components/dialogs/HelpDialog";
import { FormulaSection } from "./components/parameters/FormulaSection";
import { InterpretationSection } from "./components/parameters/InterpretationSection";
import { LanguageSection } from "./components/parameters/LanguageSection";
import { ParameterDrawer } from "./components/parameters/ParameterDrawer";
import { Toast } from "./components/ui/Toast";
import { ValidationDialog } from "./components/validation/ValidationDialog";
import { Workspace } from "./components/workspace/Workspace";
import {
    createDefaultFunctionOutputs,
    getPredicateTupleValues,
    getInterpretationErrors,
} from "./domain/interpretation";
import {
    classifySyntaxSymbol,
    clearSyntaxNodeSubstitution,
    findSyntaxNode,
    getEnvironmentNodeIds,
    getFreeVariables,
    getSubstitutionValues,
    getSubstitutedVariables,
    inferSyntaxNodeKind,
    isVariableLabel,
    serializeSyntaxTree,
    substituteFreeVariable,
    trackSyntaxNodeSubstitution,
    type SyntaxNode,
} from "./domain/syntaxTree";
import {
    buildInterpretation,
    EvaluationError,
    evaluateFormula,
    type EvaluationResult,
} from "./domain/evaluation";
import {
    getValidationState,
    validateFormulaText,
    validateSyntaxTree,
    type LanguageSignature,
} from "./domain/validation";
import type {
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
    const [formulaOrigin, setFormulaOrigin] = useState<"text" | "tree">("text");
    const [syntaxTree, setSyntaxTree] = useState<SyntaxNode | null>(null);
    const [renderedFormula, setRenderedFormula] = useState(formula);
    const [functionOutputs, setFunctionOutputs] = useState<Record<string, string>>(() =>
        createDefaultFunctionOutputs(domain, functions)
    );
    const [predicateTuples, setPredicateTuples] = useState<Record<string, string[]>>({
        P: ["(1, 0)", "(2, 0)"],
        Q: ["1", "0"],
    });
    const [environmentValues, setEnvironmentValues] = useState<Record<string, string>>({});
    const [controlEditMode, setControlEditMode] = useState(false);
    const [editModeLocked, setEditModeLocked] = useState(false);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const [evidenceOpen, setEvidenceOpen] = useState(false);
    const [validationOpen, setValidationOpen] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const formulaInputRef = useRef<HTMLInputElement>(null);
    const drawerContentRef = useRef<HTMLDivElement>(null);
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
        (variable) => !domain.includes(environmentValues[variable]?.trim() ?? ""),
    );
    const signature = useMemo<LanguageSignature>(
        () => ({ functions, predicates, domain }),
        [domain, functions, predicates],
    );
    const textValidation = useMemo(
        () => formulaOrigin === "text"
            ? validateFormulaText(formula, signature, environmentValues)
            : null,
        [environmentValues, formula, formulaOrigin, signature],
    );
    const formulaValidation = useMemo(
        () => textValidation
            ?? (syntaxTree
                ? validateSyntaxTree(syntaxTree, signature, environmentValues)
                : validateFormulaText("", signature)),
        [environmentValues, signature, syntaxTree, textValidation],
    );
    const validationState = getValidationState(formulaValidation);
    const treeIsStale = formulaOrigin === "text"
        && validationState !== "empty"
        && !textValidation?.tree
        && syntaxTree !== null;
    const errorNodeIds = useMemo(
        () => treeIsStale
            ? []
            : formulaValidation.diagnostics.flatMap(({ code, nodeId, severity, stage }) =>
                nodeId
                && severity === "error"
                && (stage !== "environment" || code === "environment-value-outside-domain")
                    ? [nodeId]
                    : []
            ),
        [formulaValidation, treeIsStale],
    );
    const environmentErrorNodeIds = useMemo(
        () => treeIsStale
            ? []
            : formulaValidation.diagnostics.flatMap(({ nodeId, severity, stage }) =>
                nodeId && severity === "error" && stage === "environment" ? [nodeId] : []
            ),
        [formulaValidation, treeIsStale],
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

    const interpretation = useMemo(
        () => buildInterpretation({ domain, functions, predicates, functionOutputs, predicateTuples }),
        [domain, functionOutputs, functions, predicateTuples, predicates],
    );
    const { evaluation, evaluationError } = useMemo((): {
        evaluation: EvaluationResult | null;
        evaluationError: string | null;
    } => {
        const tree = formulaValidation.tree;
        if (!tree || validationState !== "valid" || interpretationErrors.length > 0) {
            return { evaluation: null, evaluationError: null };
        }
        try {
            return { evaluation: evaluateFormula(tree, interpretation, environmentValues), evaluationError: null };
        } catch (error) {
            if (error instanceof EvaluationError) return { evaluation: null, evaluationError: error.message };
            throw error;
        }
    }, [environmentValues, formulaValidation, interpretation, interpretationErrors, validationState]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Control") setControlEditMode(true);
            if (event.key === "Escape") {
                setHelpOpen(false);
                setEvidenceOpen(false);
                setValidationOpen(false);
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
        const parsedTree = textValidation?.tree;
        if (!parsedTree) return;
        if (syntaxTree && treeShape(syntaxTree) === treeShape(parsedTree)) return;
        setSyntaxTree(parsedTree);
        setRenderedFormula(formula.trim());
        setEnvironmentValues({});
        setSelectedNode(null);
        setEditModeLock(false);
    }, [textValidation]);

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

    const changeFormula = (value: string) => {
        setFormula(value);
        setFormulaOrigin("text");
    };

    const insertOperator = (operator: string) => {
        const input = formulaInputRef.current;
        const start = input?.selectionStart ?? formula.length;
        const end = input?.selectionEnd ?? formula.length;
        changeFormula(`${formula.slice(0, start)}${operator}${formula.slice(end)}`);
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

    const removeDomainValue = (value: string) => {
        setDomain((current) => current.filter((item) => item !== value));
        setPredicateTuples((current) =>
            Object.fromEntries(
                Object.entries(current).map(([predicate, tuples]) => [
                    predicate,
                    tuples.filter(
                        (tuple) => !getPredicateTupleValues(tuple).includes(value),
                    ),
                ]),
            ),
        );
    };

    const commitTree = (tree: SyntaxNode) => {
        const nextFormula = serializeSyntaxTree(tree);
        setFormulaOrigin("tree");
        setSyntaxTree(tree);
        setFormula(nextFormula);
        setRenderedFormula(nextFormula);
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

        commitTree(reconciledTree);
        setEnvironmentValues(nextEnvironmentValues);
    };

    const updateEnvironment = (variable: string, value: string) => {
        setEnvironmentValues((current) => ({ ...current, [variable]: value }));
        if (!syntaxTree) return;
        commitTree(substituteFreeVariable(syntaxTree, variable, value));
    };

    const revealEnvironment = () => {
        setDrawerOpen(true);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const content = drawerContentRef.current;
                if (!content) return;
                content.scrollTo({ top: content.scrollHeight, behavior: "smooth" });
            });
        });
    };

    return (
        <main className={`app-shell ${drawerOpen ? "drawer-is-open" : ""}`}>
            <Workspace
                editMode={editMode}
                errorNodeIds={errorNodeIds}
                environmentErrorNodeIds={environmentErrorNodeIds}
                evaluation={evaluation}
                interpretationErrors={interpretationErrors}
                environmentMissing={environmentMissing}
                formula={formulaOrigin === "text" && !textValidation?.tree ? formula : renderedFormula}
                freeVariables={formulaValidation.freeVariables}
                functionSymbols={functionSymbols}
                onOpenEvidence={() =>
                    validationState === "valid" || validationState === "empty"
                        ? setEvidenceOpen(true)
                        : setValidationOpen(true)
                }
                onOpenHelp={() => setHelpOpen(true)}
                onOpenValidation={() => setValidationOpen(true)}
                onRequestEnvironment={revealEnvironment}
                onSelectNode={selectNode}
                onTreeChange={updateTree}
                predicateSymbols={predicateSymbols}
                result={evaluation ? evaluation.value : null}
                selectedNode={selectedNode}
                tree={syntaxTree}
                treeIsStale={treeIsStale}
                validation={formulaValidation}
            />

            <ParameterDrawer
                contentRef={drawerContentRef}
                onClear={() => {
                    setFormula("");
                    setFormulaOrigin("text");
                    setRenderedFormula("");
                    setSyntaxTree(null);
                    setSelectedNode(null);
                    setEditModeLock(false);
                    setEnvironmentValues({});
                }}
                onToggle={() => setDrawerOpen((current) => !current)}
                open={drawerOpen}
            >
                <FormulaSection
                    formula={formula}
                    inputRef={formulaInputRef}
                    onFormulaChange={changeFormula}
                    onInsertOperator={insertOperator}
                    onOpenValidation={() => setValidationOpen(true)}
                    validation={formulaValidation}
                />

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
                    onRemoveDomainValue={removeDomainValue}
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
                                `(${Array.from({ length: predicate.arity }, () => "").join(", ")})`,
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
            {evidenceOpen && (
                <EvidenceDialog
                    evaluation={evaluation}
                    evaluationError={evaluationError}
                    formulaInvalid={validationState !== "valid"}
                    interpretationErrors={interpretationErrors}
                    onClose={() => setEvidenceOpen(false)}
                    onOpenValidation={() => {
                        setEvidenceOpen(false);
                        setValidationOpen(true);
                    }}
                />
            )}
            {validationOpen && (
                <ValidationDialog
                    onClose={() => setValidationOpen(false)}
                    validation={formulaValidation}
                />
            )}
            {toast && <Toast message={toast} />}
        </main>
    );
}

function treeShape(node: SyntaxNode): string {
    return `${node.kind}:${node.label}:${node.substitutedFor ?? ""}(${node.children.map(treeShape).join(",")})`;
}

export default App;
