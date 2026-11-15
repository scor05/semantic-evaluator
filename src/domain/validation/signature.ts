import { isVariableLabel } from "../syntaxTree";
import { arityName, formationRules, quote } from "./rules";
import type { FormulaDiagnostic, LanguageSignature } from "./types";

export type SymbolCategory = "function" | "predicate";

export type SymbolEntry = {
    name: string;
    category: SymbolCategory;
    arity: number;
};

export type SymbolTable = Map<string, SymbolEntry>;

const identifierPattern = /^[\p{L}_][\p{L}\p{N}_']*$/u;
const reservedNames = new Set(["φ", "ψ", "χ"]);

export function categoryName(category: SymbolCategory): string {
    return category === "function" ? "símbolo funcional" : "predicado";
}

export function describeSymbol(entry: SymbolEntry): string {
    if (entry.category === "function" && entry.arity === 0) {
        return `${quote(entry.name)} es una constante (símbolo funcional 0-ario)`;
    }
    return `${quote(entry.name)} es un ${categoryName(entry.category)} ${arityName(entry.arity)}`;
}

export function buildSymbolTable(signature: LanguageSignature): {
    table: SymbolTable;
    diagnostics: FormulaDiagnostic[];
} {
    const table: SymbolTable = new Map();
    const diagnostics: FormulaDiagnostic[] = [];
    const declarations: Array<{ name: string; category: SymbolCategory; arity: number }> = [
        ...signature.functions.map((symbol) => ({ ...symbol, category: "function" as const })),
        ...signature.predicates.map((symbol) => ({ ...symbol, category: "predicate" as const })),
    ];
    const domain = new Set(signature.domain);

    declarations.forEach((declaration, index) => {
        const name = declaration.name.trim();
        const label = categoryName(declaration.category);

        if (!name) {
            diagnostics.push({
                stage: "language",
                severity: "error",
                code: "signature-empty-name",
                title: `Hay un ${label} sin nombre`,
                reasoning: [
                    `El ${label} número ${index + 1} de la firma no tiene nombre.`,
                    "Sin nombre no puede usarse en fórmulas ni recibir interpretación.",
                ],
                rule: formationRules.signature,
                hint: "Escribe un nombre o elimina la fila.",
            });
            return;
        }

        if (!identifierPattern.test(name) || reservedNames.has(name)) {
            diagnostics.push({
                stage: "language",
                severity: "error",
                code: "signature-invalid-name",
                title: `${quote(name)} no es un nombre de símbolo válido`,
                reasoning: [
                    `El ${label} ${quote(name)} contiene caracteres que el analizador no puede separar de los símbolos lógicos, o es una metavariable (φ, ψ, χ).`,
                    "Los nombres deben empezar con una letra y contener solo letras, dígitos, _ o '.",
                ],
                rule: formationRules.alphabet,
                hint: "Usa nombres como f, g, suma, P, Menor o R2.",
            });
            return;
        }

        if (isVariableLabel(name)) {
            diagnostics.push({
                stage: "language",
                severity: "error",
                code: "signature-variable-name",
                title: `${quote(name)} está reservado para variables`,
                reasoning: [
                    `Se declaró ${quote(name)} como ${label}, pero ese nombre corresponde a una variable individual.`,
                    "Las variables son símbolos lógicos; si también fueran símbolos no lógicos, cada aparición sería ambigua.",
                ],
                rule: formationRules.variables,
                hint: "Renombra el símbolo, por ejemplo a, c, f o h.",
            });
            return;
        }

        const previous = table.get(name);
        if (previous) {
            const sameCategory = previous.category === declaration.category;
            diagnostics.push({
                stage: "language",
                severity: "error",
                code: sameCategory ? "signature-duplicate" : "signature-ambiguous",
                title: sameCategory
                    ? `${quote(name)} está declarado dos veces`
                    : `${quote(name)} es a la vez función y predicado`,
                reasoning: sameCategory
                    ? [
                        `${quote(name)} aparece dos veces como ${label}${previous.arity !== declaration.arity ? `, con aridades ${previous.arity} y ${declaration.arity}` : ""}.`,
                        "Cada símbolo necesita una única aridad para verificar sus usos y para recibir una sola interpretación.",
                    ]
                    : [
                        `${quote(name)} se declaró como ${categoryName(previous.category)} y como ${label}.`,
                        "Un símbolo funcional produce términos (individuos) y un predicado produce fórmulas (valores de verdad); no puede ser ambas cosas.",
                    ],
                rule: formationRules.signature,
                hint: "Elimina o renombra una de las declaraciones.",
            });
            return;
        }

        if (domain.has(name)) {
            diagnostics.push({
                stage: "language",
                severity: "error",
                code: "signature-domain-clash",
                title: `${quote(name)} es también un elemento del dominio`,
                reasoning: [
                    `${quote(name)} se declaró como ${label} y además figura en D.`,
                    "Los símbolos del lenguaje (sintaxis) y los elementos del dominio (semántica) son niveles distintos; con el mismo nombre no se sabría a cuál se refiere la fórmula ni el entorno.",
                ],
                rule: formationRules.signature,
                hint: "Renombra el símbolo o el elemento del dominio.",
            });
        }

        table.set(name, { name, category: declaration.category, arity: declaration.arity });
    });

    if (signature.domain.length === 0) {
        diagnostics.push({
            stage: "language",
            severity: "error",
            code: "domain-empty",
            title: "El dominio está vacío",
            reasoning: [
                "D = ∅: no hay individuos que puedan denotar los términos.",
                "Los cuantificadores recorren D y el entorno asigna elementos de D; con D vacío ninguna de las dos cosas es posible.",
            ],
            rule: formationRules.domain,
            hint: "Agrega al menos un elemento al dominio.",
        });
    }

    for (const element of signature.domain) {
        if (/[\s(),]/u.test(element)) {
            diagnostics.push({
                stage: "language",
                severity: "error",
                code: "domain-invalid-element",
                title: `El elemento ${quote(element)} del dominio no es representable`,
                reasoning: [
                    `${quote(element)} contiene espacios, comas o paréntesis.`,
                    "Esos caracteres separan los componentes de las tuplas, así que una tupla que lo contenga no podría leerse sin ambigüedad.",
                ],
                rule: formationRules.domain,
                hint: "Usa elementos como 0, 1, a, b o s1.",
            });
        }
    }

    return { table, diagnostics };
}

export function suggestSymbols(label: string, table: SymbolTable): string[] {
    const lower = label.toLowerCase();
    return [...table.keys()]
        .filter((name) =>
            name.toLowerCase() === lower
            || (Math.min([...name].length, [...label].length) >= 3 && editDistance(name, label) <= 1)
        )
        .slice(0, 3);
}

function editDistance(a: string, b: string): number {
    const left = [...a];
    const right = [...b];
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
        const current = [i];
        for (let j = 1; j <= right.length; j += 1) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            current[j] = Math.min(
                (current[j - 1] ?? 0) + 1,
                (previous[j] ?? 0) + 1,
                (previous[j - 1] ?? 0) + cost,
            );
        }
        previous = current;
    }
    return previous[right.length] ?? 0;
}
