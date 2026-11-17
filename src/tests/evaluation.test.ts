import { describe, expect, test } from "bun:test";
import {
    buildInterpretation,
    evaluateFormula,
    EvaluationError,
    indexRelevantEvaluationTraces,
} from "../domain/evaluation";
import { validateFormulaText } from "../domain/validation";
import type { FunctionDefinition, PredicateDefinition } from "../types/logic";

type Setup = {
    domain: string[];
    functions?: Array<FunctionDefinition & { table: Record<string, string> }>;
    predicates: Array<PredicateDefinition & { tuples: string[] }>;
};

function evaluator(setup: Setup) {
    const functions = setup.functions ?? [];
    const functionOutputs: Record<string, string> = {};
    for (const definition of functions) {
        for (const [key, value] of Object.entries(definition.table)) {
            functionOutputs[`${definition.id}:${key}`] = value;
        }
    }
    const interpretation = buildInterpretation({
        domain: setup.domain,
        functions,
        predicates: setup.predicates,
        functionOutputs,
        predicateTuples: Object.fromEntries(setup.predicates.map(({ name, tuples }) => [name, tuples])),
    });
    const signature = { domain: setup.domain, functions, predicates: setup.predicates };

    return (formula: string, environment: Record<string, string> = {}) => {
        const validation = validateFormulaText(formula, signature, environment);
        expect(validation.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
        if (!validation.tree) throw new Error("sin árbol");
        return evaluateFormula(validation.tree, interpretation, environment);
    };
}

describe("ejemplo 7.2: D = {1,2,3}, Pᴵ = {1,2}, Rᴵ = {(1,3),(2,1),(3,2)}", () => {
    const evaluate = evaluator({
        domain: ["1", "2", "3"],
        predicates: [
            { id: 1, name: "P", arity: 1, tuples: ["1", "2"] },
            { id: 2, name: "R", arity: 2, tuples: ["(1, 3)", "(2, 1)", "(3, 2)"] },
        ],
    });

    test("∀x P(x) es falsa con contraejemplo x = 3", () => {
        const result = evaluate("∀x P(x)");
        expect(result.value).toBe(false);
        expect(result.trace.quantifier?.mode).toBe("counterexample");
        expect(result.trace.quantifier?.decisiveElement).toBe("3");
        expect(result.trace.summary).toContain("Contraejemplo");
    });

    test("∀x∃y R(x,y) es verdadera con comprobación completa y un testigo por cada x", () => {
        const result = evaluate("∀x∃y R(x,y)");
        expect(result.value).toBe(true);
        expect(result.trace.quantifier?.mode).toBe("complete");
        expect(result.trace.quantifier?.checks.map(({ element }) => element)).toEqual(["1", "2", "3"]);
        const witnesses = result.trace.quantifier?.checks.map(({ trace }) => trace.quantifier?.decisiveElement);
        expect(witnesses).toEqual(["3", "1", "2"]);
    });

    test("∀x∀y(P(x) → R(x,y)) falla en x = 1, y = 1", () => {
        const result = evaluate("∀x∀y(P(x) → R(x,y))");
        expect(result.value).toBe(false);
        expect(result.decisiveChain.map(({ formula }) => formula)).toEqual([
            "∀x ∀y(P(x) → R(x, y))",
            "∀y(P(x) → R(x, y))",
            "(P(x) → R(x, y))",
        ]);
        const last = result.decisiveChain.at(-1);
        expect(last?.bindings).toEqual([
            { variable: "x", value: "1" },
            { variable: "y", value: "1" },
        ]);
        const indexed = indexRelevantEvaluationTraces(result.trace);
        expect(last && indexed.get(last.nodeId)?.bindings).toEqual(last?.bindings);
    });
});

describe("ejemplo 7.4: D = {a,b,c}, iᴵ = a", () => {
    const evaluate = evaluator({
        domain: ["a", "b", "c"],
        functions: [{ id: 1, name: "i", arity: 0, table: { constant: "a" } }],
        predicates: [
            { id: 1, name: "R", arity: 1, tuples: ["b", "c"] },
            { id: 2, name: "Q", arity: 2, tuples: ["(a, a)", "(a, b)", "(a, c)", "(b, c)", "(c, c)"] },
        ],
    });

    test("∃y Q(i,y) es verdadera con testigo a", () => {
        const result = evaluate("∃y Q(i,y)");
        expect(result.value).toBe(true);
        expect(result.trace.quantifier?.mode).toBe("witness");
        expect(result.trace.quantifier?.decisiveElement).toBe("a");
        expect(result.trace.quantifier?.unchecked).toEqual(["b", "c"]);
        expect(result.trace.quantifier?.checks[0]?.trace.steps).toContain("i = iᴵ = a");
    });

    test("¬R(i) es verdadera", () => {
        const result = evaluate("¬R(i)");
        expect(result.value).toBe(true);
        expect(result.trace.children[0]?.trace.steps.at(-1)).toBe("a ∉ Rᴵ");
    });

    test("Q no es funcional: contraejemplo x = a, y = a, z = b", () => {
        const result = evaluate("∀x∀y∀z((Q(x,y) ∧ Q(x,z)) → y=z)");
        expect(result.value).toBe(false);
        const last = result.decisiveChain.at(-1);
        expect(last?.kind).toBe("implies");
        expect(last?.bindings).toEqual([
            { variable: "x", value: "a" },
            { variable: "y", value: "a" },
            { variable: "z", value: "b" },
        ]);
    });

    test("∀x∃y Q(x,y) es verdadera", () => {
        expect(evaluate("∀x∃y Q(x,y)").value).toBe(true);
    });
});

describe("ejemplo 8.5: dependencia del entorno", () => {
    const evaluate = evaluator({
        domain: ["0", "1", "2"],
        predicates: [{ id: 1, name: "P", arity: 2, tuples: ["(0, 1)", "(0, 2)", "(1, 2)"] }],
    });

    test("P(x,y) con l₁ es verdadera y con l₂ es falsa", () => {
        expect(evaluate("P(x,y)", { x: "0", y: "2" }).value).toBe(true);
        const result = evaluate("P(x,y)", { x: "2", y: "1" });
        expect(result.value).toBe(false);
        expect(result.trace.summary).toContain("(2, 1) ∉ Pᴵ");
        expect(result.environment).toEqual([
            { variable: "x", value: "2" },
            { variable: "y", value: "1" },
        ]);
    });

    test("los elementos del dominio pueden escribirse como términos literales", () => {
        const result = evaluate("∀x P(x,0)");
        expect(result.value).toBe(false);
        expect(result.trace.quantifier?.decisiveElement).toBe("0");
    });

    test("un árbol con valores ya asignados por el entorno se evalúa como fórmula abierta", () => {
        const validation = validateFormulaText("P(x,y)", {
            domain: ["0", "1", "2"],
            functions: [],
            predicates: [{ name: "P", arity: 2 }],
        });
        const tree = validation.tree!;
        const substituted = {
            ...tree,
            children: tree.children.map((child, index) => ({
                ...child,
                label: index === 0 ? "0" : "2",
                kind: "value" as const,
                substitutedFor: child.label,
            })),
        };
        const interpretation = buildInterpretation({
            domain: ["0", "1", "2"],
            functions: [],
            predicates: [{ id: 1, name: "P", arity: 2 }],
            functionOutputs: {},
            predicateTuples: { P: ["(0, 2)"] },
        });
        const result = evaluateFormula(substituted, interpretation, {});
        expect(result.value).toBe(true);
        expect(result.trace.formula).toBe("P(x, y)");
        expect(result.environment).toEqual([
            { variable: "x", value: "0" },
            { variable: "y", value: "2" },
        ]);
    });

    test("∃x∀y P(x,y) es falsa con comprobación completa", () => {
        const result = evaluate("∃x∀y P(x,y)");
        expect(result.value).toBe(false);
        expect(result.trace.quantifier?.mode).toBe("complete");
        expect(result.trace.quantifier?.checks.every(({ trace }) => trace.quantifier?.mode === "counterexample")).toBe(true);
    });

    test("una fórmula abierta sin entorno no recibe valor", () => {
        const validation = validateFormulaText("P(x,y)", {
            domain: ["0", "1", "2"],
            functions: [],
            predicates: [{ name: "P", arity: 2 }],
        });
        const interpretation = buildInterpretation({
            domain: ["0", "1", "2"],
            functions: [],
            predicates: [{ id: 1, name: "P", arity: 2 }],
            functionOutputs: {},
            predicateTuples: { P: ["(0, 1)"] },
        });
        expect(() => evaluateFormula(validation.tree!, interpretation, { x: "0" })).toThrow(EvaluationError);
    });
});

describe("conectivos, igualdad y funciones", () => {
    const evaluate = evaluator({
        domain: ["0", "1", "2"],
        functions: [
            { id: 1, name: "s", arity: 1, table: { "0": "1", "1": "2", "2": "0" } },
            { id: 2, name: "c", arity: 0, table: { constant: "0" } },
        ],
        predicates: [{ id: 1, name: "E", arity: 1, tuples: ["0", "2"] }],
    });

    test("igualdad con funciones anidadas", () => {
        const result = evaluate("s(s(s(c))) = c");
        expect(result.value).toBe(true);
        expect(result.trace.steps).toEqual([
            "c = cᴵ = 0",
            "s(c) = sᴵ(0) = 1",
            "s(s(c)) = sᴵ(1) = 2",
            "s(s(s(c))) = sᴵ(2) = 0",
            "0 = 0",
        ]);
    });

    test("implicación con antecedente falso", () => {
        const result = evaluate("E(s(c)) → ¬E(c)");
        expect(result.value).toBe(true);
        expect(result.trace.summary).toContain("antecedente es falso");
        expect(result.trace.children.map(({ decisive }) => decisive)).toEqual([true, false]);
    });

    test("disyunción verdadera por el operando derecho", () => {
        const result = evaluate("E(s(c)) ∨ E(c)");
        expect(result.value).toBe(true);
        expect(result.decisiveChain.at(-1)?.formula).toBe("E(c)");
    });

    test("conjunción falsa por el operando izquierdo", () => {
        const result = evaluate("∀x(E(x) ∧ x = x)");
        expect(result.value).toBe(false);
        expect(result.trace.quantifier?.decisiveElement).toBe("1");
    });

    test("el valor inicial de una variable ligada no influye", () => {
        expect(evaluate("∀x E(x) ∨ E(x)", { x: "0" }).value).toBe(true);
        expect(evaluate("∀x E(x) ∨ E(x)", { x: "1" }).value).toBe(false);
        expect(evaluate("∃x E(x)", {}).value).toBe(true);
    });
});
