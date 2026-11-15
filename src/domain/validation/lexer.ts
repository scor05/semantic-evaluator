import { formationRules, quote } from "./rules";
import type { FormulaDiagnostic, Span } from "./types";

export type TokenType =
    | "lparen"
    | "rparen"
    | "comma"
    | "not"
    | "and"
    | "or"
    | "implies"
    | "iff"
    | "forall"
    | "exists"
    | "equals"
    | "name";

export type Token = {
    type: TokenType;
    text: string;
    span: Span;
    alias?: string;
};

const operatorTable: Array<{ text: string; type: TokenType; canonical: string }> = [
    { text: "<->", type: "iff", canonical: "↔" },
    { text: "->", type: "implies", canonical: "→" },
    { text: "=>", type: "implies", canonical: "→" },
    { text: "&&", type: "and", canonical: "∧" },
    { text: "||", type: "or", canonical: "∨" },
    { text: "/\\", type: "and", canonical: "∧" },
    { text: "\\/", type: "or", canonical: "∨" },
    { text: "(", type: "lparen", canonical: "(" },
    { text: ")", type: "rparen", canonical: ")" },
    { text: ",", type: "comma", canonical: "," },
    { text: "¬", type: "not", canonical: "¬" },
    { text: "~", type: "not", canonical: "¬" },
    { text: "!", type: "not", canonical: "¬" },
    { text: "∧", type: "and", canonical: "∧" },
    { text: "&", type: "and", canonical: "∧" },
    { text: "∨", type: "or", canonical: "∨" },
    { text: "|", type: "or", canonical: "∨" },
    { text: "→", type: "implies", canonical: "→" },
    { text: "⇒", type: "implies", canonical: "→" },
    { text: "↔", type: "iff", canonical: "↔" },
    { text: "⇔", type: "iff", canonical: "↔" },
    { text: "∀", type: "forall", canonical: "∀" },
    { text: "∃", type: "exists", canonical: "∃" },
    { text: "=", type: "equals", canonical: "=" },
];

const unknownCharacterHints: Record<string, string> = {
    ".": "No se usa punto después del cuantificador: escribe ∀x φ o ∀x(φ).",
    ":": "No se usan dos puntos después del cuantificador: escribe ∀x φ o ∀x(φ).",
    "[": "Para agrupar usa solo paréntesis ( ).",
    "]": "Para agrupar usa solo paréntesis ( ).",
    "{": "Para agrupar usa solo paréntesis ( ).",
    "}": "Para agrupar usa solo paréntesis ( ).",
    ";": "Los argumentos se separan con comas.",
    "≠": "La desigualdad no es primitiva: escribe ¬(t₁ = t₂).",
    "<": "< no es un símbolo lógico: declara un predicado binario (p. ej. Menor) y escribe Menor(x, y).",
    ">": "> no es un símbolo lógico: declara un predicado binario y úsalo en notación prefija.",
    "≤": "≤ no es un símbolo lógico: declara un predicado binario (p. ej. P) y escribe P(x, y).",
    "≥": "≥ no es un símbolo lógico: declara un predicado binario y úsalo en notación prefija.",
    "+": "+ no es un símbolo lógico: declara un símbolo funcional binario (p. ej. suma) y escribe suma(x, y).",
    "*": "* no es un símbolo lógico: declara un símbolo funcional binario y úsalo en notación prefija.",
    "-": "Si querías una implicación escribe → o ->. Si es una resta, declárala como función.",
    "⊆": "⊆ no es un símbolo lógico: declara un predicado binario y úsalo en notación prefija.",
    "∈": "∈ no es un símbolo lógico: declara un predicado binario y úsalo en notación prefija.",
};

const namePattern = /[\p{L}\p{N}_']+/uy;

export function lex(input: string): {
    tokens: Token[];
    diagnostics: FormulaDiagnostic[];
} {
    const tokens: Token[] = [];
    const diagnostics: FormulaDiagnostic[] = [];
    const aliasesSeen = new Set<string>();
    let position = 0;

    while (position < input.length) {
        const character = input[position] ?? "";
        if (/\s/u.test(character)) {
            position += 1;
            continue;
        }

        const operator = operatorTable.find(({ text }) => input.startsWith(text, position));
        if (operator?.type === "iff") {
            const span = { start: position, end: position + operator.text.length };
            diagnostics.push({
                stage: "lexical",
                severity: "error",
                code: "lexical-unsupported-connective",
                title: `${quote(operator.text)} no es un conectivo del lenguaje`,
                reasoning: [
                    `En la columna ${span.start + 1} aparece el bicondicional ${quote(operator.text)}.`,
                    "Los únicos conectivos definidos como símbolos lógicos en el curso son ¬, ∧, ∨ y →.",
                    "El bicondicional no es primitivo: φ ↔ ψ es una abreviatura de ((φ → ψ) ∧ (ψ → φ)).",
                ],
                rule: formationRules.alphabet,
                hint: "Reescríbelo como ((φ → ψ) ∧ (ψ → φ)).",
                span,
            });
            position = span.end;
            continue;
        }

        if (operator) {
            const span = { start: position, end: position + operator.text.length };
            const isAlias = operator.text !== operator.canonical;
            tokens.push({
                type: operator.type,
                text: operator.canonical,
                span,
                alias: isAlias ? operator.text : undefined,
            });
            if (isAlias && !aliasesSeen.has(operator.text)) {
                aliasesSeen.add(operator.text);
                diagnostics.push({
                    stage: "lexical",
                    severity: "info",
                    code: "lexical-alias",
                    title: `${quote(operator.text)} se leyó como ${operator.canonical}`,
                    reasoning: [
                        `${quote(operator.text)} es una forma de teclado aceptada para el conectivo ${operator.canonical}.`,
                    ],
                    span,
                });
            }
            position = span.end;
            continue;
        }

        namePattern.lastIndex = position;
        const name = namePattern.exec(input);
        if (name) {
            const span = { start: position, end: position + name[0].length };
            tokens.push({ type: "name", text: name[0], span });
            position = span.end;
            continue;
        }

        const codePoint = String.fromCodePoint(input.codePointAt(position) ?? 0);
        const span = { start: position, end: position + codePoint.length };
        diagnostics.push({
            stage: "lexical",
            severity: "error",
            code: "lexical-unknown-character",
            title: `El carácter ${quote(codePoint)} no pertenece al alfabeto`,
            reasoning: [
                `En la columna ${span.start + 1} aparece ${quote(codePoint)}.`,
                "No es un símbolo lógico, ni forma parte del nombre de una variable o de un símbolo declarado.",
                "Una cadena con símbolos ajenos al alfabeto Σ no puede ser una expresión bien formada.",
            ],
            rule: formationRules.alphabet,
            hint: unknownCharacterHints[codePoint],
            span,
        });
        position = span.end;
    }

    return { tokens, diagnostics };
}

export function describeToken(token: Token | undefined): string {
    if (!token) return "el final de la fórmula";
    switch (token.type) {
        case "lparen":
            return "“(”";
        case "rparen":
            return "“)”";
        case "comma":
            return "una coma";
        case "name":
            return quote(token.text);
        default:
            return quote(token.text);
    }
}
