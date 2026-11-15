import { describe, expect, test } from "bun:test";
import {
    firstError,
    validateFormulaText,
    validateSyntaxTree,
    type FormulaValidation,
    type LanguageSignature,
} from "../src/domain/validation";
import { createSyntaxNode, type SyntaxNode } from "../src/domain/syntaxTree";

const classLanguage: LanguageSignature = {
    functions: [
        { name: "m", arity: 0 },
        { name: "f", arity: 1 },
        { name: "g", arity: 2 },
    ],
    predicates: [
        { name: "S", arity: 2 },
        { name: "B", arity: 2 },
        { name: "P", arity: 1 },
        { name: "Q", arity: 1 },
        { name: "R", arity: 2 },
    ],
    domain: ["a", "b", "c"],
};

function codes(validation: FormulaValidation, severity = "error"): string[] {
    return validation.diagnostics
        .filter((diagnostic) => diagnostic.severity === severity)
        .map(({ code }) => code);
}

function text(input: string, environment?: Record<string, string>): FormulaValidation {
    return validateFormulaText(input, classLanguage, environment);
}

describe("ejercicios de análisis sintáctico (sección 3.7)", () => {
    test("S(m,x) es fórmula abierta con x libre", () => {
        const result = text("S(m,x)");
        expect(codes(result)).toEqual([]);
        expect(result.freeVariables).toEqual(["x"]);
    });

    test("B(m,f(m)) es un enunciado", () => {
        const result = text("B(m,f(m))", {});
        expect(result.ok).toBe(true);
        expect(result.freeVariables).toEqual([]);
    });

    test("f(m) es un término y no una fórmula", () => {
        expect(codes(text("f(m)"))).toEqual(["category-term-as-formula"]);
    });

    test("B(B(m,x),y) usa una fórmula como término", () => {
        const result = text("B(B(m,x),y)");
        expect(codes(result)).toEqual(["category-formula-as-term"]);
        expect(firstError(result)?.span).toEqual({ start: 2, end: 8 });
    });

    test("S(B(m),z) falla por aridad y por categoría", () => {
        expect(codes(text("S(B(m),z)")).sort()).toEqual(["arity-predicate", "category-formula-as-term"]);
    });

    test("B(x,y) → ∃z S(z,y) es bien formada y abierta", () => {
        const result = text("B(x,y) → ∃z S(z,y)");
        expect(codes(result)).toEqual([]);
        expect(result.freeVariables).toEqual(["x", "y"]);
        expect(result.reading).toBe("(B(x, y) → ∃z S(z, y))");
    });

    test("S(x,y) → S(y,f(f(x))) es bien formada", () => {
        expect(codes(text("S(x,y) → S(y,f(f(x)))"))).toEqual([]);
    });

    test("B con aridad incorrecta", () => {
        const result = text("B(m,x,y)");
        expect(codes(result)).toEqual(["arity-predicate"]);
        expect(firstError(result)?.title).toContain("binario");
    });
});

describe("errores léxicos", () => {
    test("carácter fuera del alfabeto", () => {
        const result = text("P(x) # Q(x)");
        expect(codes(result)).toEqual(["lexical-unknown-character"]);
        expect(result.tree).toBeNull();
        expect(result.stages.find(({ stage }) => stage === "syntax")?.status).toBe("skipped");
    });

    test("el bicondicional no es conectivo del curso", () => {
        expect(codes(text("P(x) ↔ Q(x)"))).toEqual(["lexical-unsupported-connective"]);
        expect(codes(text("P(x) <-> Q(x)"))).toEqual(["lexical-unsupported-connective"]);
    });

    test("alias de teclado se aceptan con nota", () => {
        const result = text("∀x(P(x) -> ~Q(x))");
        expect(result.ok).toBe(true);
        expect(codes(result, "info")).toEqual(["lexical-alias", "lexical-alias"]);
    });
});

describe("errores sintácticos", () => {
    const cases: Array<[string, string]> = [
        ["", "syntax-empty"],
        ["P(x", "syntax-unclosed-parenthesis"],
        ["(P(x) ∧ Q(x)", "syntax-unclosed-parenthesis"],
        ["P(x))", "syntax-unmatched-parenthesis"],
        ["P(x) Q(x)", "syntax-trailing-input"],
        ["P(x) ∧", "syntax-right-operand-missing"],
        ["∧ P(x)", "syntax-left-operand-missing"],
        ["¬", "syntax-negation-operand-missing"],
        ["∀x", "syntax-quantifier-body-missing"],
        ["∀ P(x)", "syntax-quantifier-variable-missing"],
        ["∀z P(z) ∧ ∃", "syntax-quantifier-variable-missing"],
        ["∀P P(m)", "syntax-second-order"],
        ["∀f P(f)", "syntax-quantified-function"],
        ["∀xy S(x,y)", "syntax-quantifier-not-variable"],
        ["S(x,)", "syntax-argument-missing"],
        ["m()", "syntax-empty-arguments"],
        ["()", "syntax-empty-parentheses"],
        ["x = y = m", "syntax-equality-chain"],
        ["x =", "syntax-equality-right-missing"],
        ["S(x y)", "syntax-argument-separator"],
    ];

    for (const [input, code] of cases) {
        test(`${JSON.stringify(input)} → ${code}`, () => {
            const result = text(input);
            expect(result.ok).toBe(false);
            expect(result.tree).toBeNull();
            expect(codes(result)).toEqual([code]);
        });
    }

    test("∀xP(x) separa la variable del predicado", () => {
        const result = text("∀xP(x)");
        expect(result.ok).toBe(true);
        expect(codes(result, "info")).toEqual(["syntax-glued-quantifier"]);
    });

    test("la precedencia implícita se informa", () => {
        const result = text("P(m) ∧ Q(m) ∨ P(m)");
        expect(result.reading).toBe("((P(m) ∧ Q(m)) ∨ P(m))");
        expect(codes(result, "info")).toEqual(["syntax-implicit-grouping"]);
    });

    test("→ asocia a la derecha", () => {
        const result = text("P(m) → Q(m) → P(m)");
        expect(result.reading).toBe("(P(m) → (Q(m) → P(m)))");
        expect(codes(result, "info")).toEqual(["syntax-right-associative"]);
    });
});

describe("símbolos", () => {
    test("símbolo no declarado con sugerencia", () => {
        const result = text("p(x)");
        expect(codes(result)).toEqual(["symbols-undeclared"]);
        expect(firstError(result)?.hint).toContain("“P”");
    });

    test("un elemento del dominio no es un término", () => {
        expect(codes(text("P(a)"))).toEqual(["symbols-domain-element"]);
    });

    test("variables con subíndice", () => {
        const result = text("∀x₁ P(x₁) ∧ Q(y2)");
        expect(codes(result)).toEqual([]);
        expect(result.freeVariables).toEqual(["y2"]);
    });
});

describe("variables y alcance (sección 4)", () => {
    test("∀x P(x) → Q(x): la segunda x queda libre", () => {
        const result = text("∀x P(x) → Q(x)");
        expect(codes(result)).toEqual([]);
        expect(result.freeVariables).toEqual(["x"]);
        const warning = result.diagnostics.find(({ code }) => code === "variables-free-and-bound");
        expect(warning?.span).toEqual({ start: 12, end: 13 });
        expect(warning?.reasoning.join(" ")).toContain("El alcance de ∀x es solo “P(x)”");
    });

    test("∀x P(x) → ∃x Q(x) es un enunciado", () => {
        const result = text("∀x P(x) → ∃x Q(x)");
        expect(result.freeVariables).toEqual([]);
        expect(codes(result, "warning")).toEqual([]);
    });

    test("cuantificación vacía", () => {
        expect(codes(text("∀x P(m)"), "warning")).toEqual(["variables-vacuous-quantifier"]);
    });

    test("cuantificadores anidados sobre la misma variable", () => {
        const result = text("∀x(P(x) ∧ ∃x Q(x))");
        expect(codes(result, "info")).toEqual(["variables-shadowing"]);
        expect(result.freeVariables).toEqual([]);
    });
});

describe("entorno (sección 8)", () => {
    test("fórmula abierta sin entorno", () => {
        const result = text("R(x,y)", { x: "a" });
        expect(codes(result)).toEqual(["environment-missing"]);
        expect(firstError(result)?.title).toContain("y");
    });

    test("valor fuera del dominio", () => {
        expect(codes(text("P(x)", { x: "z" }))).toEqual(["environment-value-outside-domain"]);
    });

    test("entorno completo", () => {
        expect(text("R(x,y)", { x: "a", y: "c" }).ok).toBe(true);
    });

    test("el entorno no se revisa si la fórmula es inválida", () => {
        const result = text("R(x)", {});
        expect(codes(result)).toEqual(["arity-predicate"]);
        expect(result.stages.find(({ stage }) => stage === "environment")?.status).toBe("skipped");
    });
});

describe("lenguaje y dominio", () => {
    test("nombre ambiguo entre función y predicado", () => {
        const result = validateFormulaText("P(m)", {
            ...classLanguage,
            functions: [...classLanguage.functions, { name: "P", arity: 1 }],
        });
        expect(codes(result)).toContain("signature-ambiguous");
    });

    test("símbolo con nombre de variable", () => {
        const result = validateFormulaText("P(m)", {
            ...classLanguage,
            functions: [...classLanguage.functions, { name: "x", arity: 0 }],
        });
        expect(codes(result)).toContain("signature-variable-name");
    });

    test("dominio vacío", () => {
        expect(codes(validateFormulaText("P(m)", { ...classLanguage, domain: [] }))).toContain("domain-empty");
    });
});

describe("validación de árboles editados", () => {
    const node = (label: string, kind: SyntaxNode["kind"], children: SyntaxNode[] = []) =>
        createSyntaxNode(label, kind, children);

    test("conectivo binario con un solo hijo", () => {
        const tree = node("∧", "connective", [node("P", "predicate", [node("x", "term")])]);
        const result = validateSyntaxTree(tree, classLanguage);
        expect(codes(result)).toEqual(["syntax-connective-operands"]);
        expect(result.input).toBe("(P(x) ∧ □)");
    });

    test("predicado bajo una función", () => {
        const inner = node("Q", "predicate", [node("x", "term")]);
        const tree = node("P", "predicate", [node("f", "function", [inner])]);
        const result = validateSyntaxTree(tree, classLanguage);
        expect(codes(result)).toEqual(["category-formula-as-term"]);
        expect(firstError(result)?.nodeId).toBe(inner.id);
    });

    test("valor asignado fuera del dominio", () => {
        const value = { ...node("z", "value"), label: "7", substitutedFor: "x" };
        const tree = node("P", "predicate", [value]);
        expect(codes(validateSyntaxTree(tree, classLanguage, { x: "7" }))).toEqual([
            "environment-value-outside-domain",
        ]);
    });

    test("valor asignado válido cuenta como variable libre con entorno", () => {
        const value = { ...node("a", "value"), substitutedFor: "x" };
        const result = validateSyntaxTree(node("P", "predicate", [value]), classLanguage, { x: "a" });
        expect(result.ok).toBe(true);
        expect(result.freeVariables).toEqual(["x"]);
    });

    test("marcador φ pendiente", () => {
        expect(codes(validateSyntaxTree(node("¬", "connective", [node("φ", "term")]), classLanguage))).toEqual([
            "syntax-placeholder",
        ]);
    });
});
