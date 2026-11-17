import { isVariableLabel, type SyntaxNode } from "../syntaxTree";
import { formatFormula, isBinaryLabel } from "./format";
import { argumentCount, arityName, formationRules, ordinal, quote } from "./rules";
import {
    describeSymbol,
    suggestSymbols,
    type SymbolEntry,
    type SymbolTable,
} from "./signature";
import type { FormulaDiagnostic, Span, ValidationStage, VariableOccurrence } from "./types";

type NodeClass =
    | { type: "connective" }
    | { type: "quantifier"; symbol: string; variable: string }
    | { type: "equality" }
    | { type: "symbol"; entry: SymbolEntry }
    | { type: "variable" }
    | { type: "assigned"; variable: string }
    | { type: "domain" }
    | { type: "placeholder" }
    | { type: "unsupported" }
    | { type: "unknown" };

type Category = "formula" | "term";

type Context = {
    parent?: SyntaxNode;
    index: number;
};

const placeholders = new Set(["φ", "ψ", "χ", "?", "□"]);

export function checkTree(
    root: SyntaxNode,
    table: SymbolTable,
    domain: ReadonlySet<string>,
    spans: Record<string, Span>,
): FormulaDiagnostic[] {
    const diagnostics: FormulaDiagnostic[] = [];

    const report = (
        node: SyntaxNode,
        stage: ValidationStage,
        diagnostic: Omit<FormulaDiagnostic, "stage" | "severity" | "nodeId" | "span">,
    ) => {
        diagnostics.push({
            stage,
            severity: "error",
            nodeId: node.id,
            span: spans[node.id],
            ...diagnostic,
        });
    };

    const classify = (node: SyntaxNode): NodeClass => classifyNode(node, table, domain);

    const check = (node: SyntaxNode, expected: Category, context: Context) => {
        const nodeClass = classify(node);
        const natural = naturalCategory(nodeClass);

        if (natural && natural !== expected) {
            if (natural === "term") {
                report(node, "category", {
                    code: "category-term-as-formula",
                    title: `${quote(formatFormula(node))} es un término, no una fórmula`,
                    reasoning: [
                        `${quote(formatFormula(node))} ${termNature(node, nodeClass)}.`,
                        "Un término denota un individuo del dominio: no es verdadero ni falso.",
                        `Aparece ${roleText(context)}, donde la regla exige una fórmula.`,
                    ],
                    rule: ruleForFormulaSlot(context.parent),
                    hint: "Aplícale un predicado, P(t), o compáralo con otro término, t = s.",
                });
            } else {
                report(node, "category", {
                    code: "category-formula-as-term",
                    title: `${quote(formatFormula(node))} es una fórmula y no puede ser argumento`,
                    reasoning: [
                        `${quote(formatFormula(node))} ${formulaNature(node, nodeClass)}.`,
                        "Las fórmulas tienen valor de verdad; en cambio, los argumentos de funciones, predicados y de “=” deben ser términos (individuos).",
                        `Aparece ${roleText(context)}.`,
                    ],
                    rule: ruleForTermSlot(context.parent, table),
                    hint: "Si querías combinar afirmaciones usa conectivos, p. ej. B(m, x) ∧ B(x, y). Si querías un individuo, usa un símbolo funcional.",
                });
            }
        }

        checkInternals(node, nodeClass);
    };

    const checkChildren = (node: SyntaxNode, category: Category) => {
        node.children.forEach((child, index) => check(child, category, { parent: node, index }));
    };

    const checkInternals = (node: SyntaxNode, nodeClass: NodeClass) => {
        switch (nodeClass.type) {
            case "connective": {
                const expected = node.label === "¬" ? 1 : 2;
                if (node.children.length !== expected) {
                    report(node, "syntax", {
                        code: "syntax-connective-operands",
                        title: `${node.label} tiene ${node.children.length} ${node.children.length === 1 ? "subfórmula" : "subfórmulas"} y necesita ${expected}`,
                        reasoning: [
                            node.label === "¬"
                                ? "La negación es unaria: se aplica a exactamente una fórmula, ¬φ."
                                : `${node.label} es binario: une exactamente dos fórmulas, (φ ${node.label} ψ).`,
                            `En el árbol, el nodo ${node.label} tiene ${node.children.length} ${node.children.length === 1 ? "hijo" : "hijos"}.`,
                        ],
                        rule: node.label === "¬" ? formationRules.negation : formationRules.binary,
                        hint: node.children.length < expected
                            ? "Agrega la subfórmula que falta como hijo del nodo."
                            : "Elimina los hijos sobrantes o agrúpalos con otro conectivo.",
                    });
                }
                checkChildren(node, "formula");
                return;
            }
            case "quantifier": {
                if (!isVariableLabel(nodeClass.variable)) {
                    const entry = table.get(nodeClass.variable);
                    report(node, "syntax", {
                        code: entry?.category === "predicate" ? "syntax-second-order" : "syntax-quantifier-not-variable",
                        title: nodeClass.variable
                            ? `${node.label} no cuantifica una variable individual`
                            : `${nodeClass.symbol} no indica qué variable liga`,
                        reasoning: [
                            entry
                                ? `${describeSymbol(entry)}, no una variable.`
                                : nodeClass.variable
                                    ? `${quote(nodeClass.variable)} no es una variable individual.`
                                    : "El cuantificador no va acompañado de ninguna variable.",
                            entry?.category === "predicate"
                                ? "Cuantificar predicados pertenece a la lógica de segundo orden; en primer orden solo se cuantifican individuos."
                                : formationRules.variables,
                        ],
                        rule: formationRules.quantifier,
                        hint: `Usa ${nodeClass.symbol}x, ${nodeClass.symbol}y, ${nodeClass.symbol}z o ${nodeClass.symbol}w.`,
                    });
                }
                if (node.children.length !== 1) {
                    report(node, "syntax", {
                        code: "syntax-quantifier-body",
                        title: node.children.length === 0
                            ? `${node.label} no tiene fórmula en su alcance`
                            : `${node.label} tiene ${node.children.length} subfórmulas en su alcance`,
                        reasoning: [
                            `Un cuantificador se aplica a exactamente una fórmula: ${node.label} φ.`,
                            `En el árbol, el nodo ${node.label} tiene ${node.children.length} ${node.children.length === 1 ? "hijo" : "hijos"}.`,
                        ],
                        rule: formationRules.quantifier,
                        hint: node.children.length === 0
                            ? "Agrega la fórmula que debe cuantificar."
                            : "Une las subfórmulas con un conectivo antes de cuantificarlas.",
                    });
                }
                checkChildren(node, "formula");
                return;
            }
            case "equality": {
                if (node.children.length !== 2) {
                    report(node, "arity", {
                        code: "arity-equality",
                        title: `“=” recibió ${argumentCount(node.children.length)} y compara exactamente 2`,
                        reasoning: [
                            "La igualdad es un símbolo lógico binario: t₁ = t₂.",
                            `Aquí tiene ${argumentCount(node.children.length)}.`,
                        ],
                        rule: formationRules.equalityAtom,
                    });
                }
                checkChildren(node, "term");
                return;
            }
            case "symbol": {
                const { entry } = nodeClass;
                if (node.children.length !== entry.arity) {
                    const used = node.children.length;
                    const shape = entry.arity === 0
                        ? entry.name
                        : `${entry.name}(${Array.from({ length: entry.arity }, (_, index) => `t${toSubscript(index + 1)}`).join(", ")})`;
                    report(node, "arity", {
                        code: entry.category === "predicate" ? "arity-predicate" : "arity-function",
                        title: `${entry.name} es ${arityName(entry.arity)} y recibió ${argumentCount(used)}`,
                        reasoning: [
                            `${describeSymbol(entry)}: siempre se aplica a ${argumentCount(entry.arity)}.`,
                            used === 0
                                ? `Aquí aparece solo, sin argumentos.`
                                : `Aquí se aplica a ${argumentCount(used)}: ${quote(formatFormula(node))}.`,
                            entry.category === "predicate"
                                ? "Con un número distinto de argumentos no se obtiene una fórmula atómica, y Pᴵ ⊆ Dⁿ no podría consultarse."
                                : "Con un número distinto de argumentos no se obtiene un término, y fᴵ: Dⁿ → D no podría aplicarse.",
                        ],
                        rule: entry.category === "predicate" ? formationRules.predicateAtom : formationRules.functionTerm,
                        hint: `Forma correcta: ${shape}.`,
                    });
                }
                checkChildren(node, "term");
                return;
            }
            case "variable": {
                if (node.children.length > 0) {
                    report(node, "arity", {
                        code: "arity-variable",
                        title: `La variable ${node.label} no lleva argumentos`,
                        reasoning: [
                            `${node.label} es una variable individual y aquí se aplica a ${argumentCount(node.children.length)}.`,
                            "Solo los símbolos funcionales y los predicados se aplican a términos.",
                        ],
                        rule: formationRules.variableTerm,
                        hint: "Si querías una función, declárala en el lenguaje con otro nombre.",
                    });
                }
                checkChildren(node, "term");
                return;
            }
            case "assigned": {
                if (!domain.has(node.label)) {
                    report(node, "environment", {
                        code: "environment-value-outside-domain",
                        title: `El valor ${quote(node.label)} asignado a ${nodeClass.variable} no está en D`,
                        reasoning: [
                            `El nodo muestra l(${nodeClass.variable}) = ${node.label}.`,
                            `Pero ${quote(node.label)} no pertenece al dominio D = {${[...domain].join(", ")}}.`,
                            "Un entorno es una función l: V → D, así que solo puede asignar elementos de D.",
                        ],
                        rule: formationRules.environment,
                        hint: "Elige un elemento del dominio en la sección Entorno.",
                    });
                }
                checkChildren(node, "term");
                return;
            }
            case "domain": {
                if (node.children.length > 0) {
                    report(node, "arity", {
                        code: "arity-domain-literal",
                        title: `El literal ${quote(node.label)} no lleva argumentos`,
                        reasoning: [
                            `${quote(node.label)} nombra directamente al elemento ${node.label} de D.`,
                            "Los literales del dominio son términos simples; solo los símbolos funcionales pueden aplicarse a argumentos.",
                        ],
                        rule: formationRules.literalTerm,
                        hint: "Elimina los hijos del literal o usa un símbolo funcional declarado.",
                    });
                }
                checkChildren(node, "term");
                return;
            }
            case "placeholder": {
                report(node, "syntax", {
                    code: "syntax-placeholder",
                    title: `Subfórmula incompleta: ${quote(node.label)}`,
                    reasoning: [
                        `${quote(node.label)} es un marcador (metavariable), no un símbolo del lenguaje.`,
                        "Indica una parte del árbol que todavía no se ha construido.",
                    ],
                    rule: formationRules.closure,
                    hint: "Reemplaza el marcador por una fórmula o un término.",
                });
                checkChildren(node, "term");
                return;
            }
            case "unsupported": {
                report(node, "symbols", {
                    code: "symbols-unsupported-connective",
                    title: `${node.label} no es un conectivo del lenguaje`,
                    reasoning: [
                        "Los conectivos definidos como símbolos lógicos son ¬, ∧, ∨ y →.",
                        "φ ↔ ψ es solo una abreviatura de ((φ → ψ) ∧ (ψ → φ)).",
                    ],
                    rule: formationRules.alphabet,
                    hint: "Reescribe el bicondicional con → y ∧.",
                });
                checkChildren(node, "formula");
                return;
            }
            case "unknown": {
                const suggestions = suggestSymbols(node.label, table);
                const used = node.children.length;
                const guess = /^\p{Lu}/u.test(node.label) ? "predicado" : "símbolo funcional";
                report(node, "symbols", {
                    code: "symbols-undeclared",
                    title: `${quote(node.label)} no está declarado`,
                    reasoning: [
                        `${quote(node.label)} no es una variable individual (w, x, y, z con subíndice opcional).`,
                        "Tampoco figura entre los símbolos funcionales ni los predicados del lenguaje.",
                        used > 0
                            ? `Se usa con ${argumentCount(used)}, como si fuera un ${guess} ${arityName(used)}.`
                            : "Los símbolos no lógicos deben declararse, con su aridad, antes de usarse.",
                    ],
                    rule: formationRules.alphabet,
                    hint: suggestions.length > 0
                        ? `¿Quisiste decir ${suggestions.map(quote).join(" o ")}?`
                        : used === 0 && guess === "símbolo funcional"
                            ? "Decláralo en Lenguaje como constante (símbolo funcional de aridad 0)."
                            : `Decláralo en Lenguaje como ${guess} de aridad ${used}.`,
                });
                checkChildren(node, "term");
                return;
            }
        }
    };

    check(root, "formula", { index: 0 });
    return diagnostics;
}

export function analyzeVariables(
    root: SyntaxNode,
    table: SymbolTable,
    domain: ReadonlySet<string>,
    spans: Record<string, Span>,
): { occurrences: VariableOccurrence[]; freeVariables: string[]; diagnostics: FormulaDiagnostic[] } {
    const occurrences: VariableOccurrence[] = [];
    const diagnostics: FormulaDiagnostic[] = [];
    const binders = new Map<string, { node: SyntaxNode; variable: string; uses: number }>();
    const parents = new Map<string, SyntaxNode>();

    const visit = (node: SyntaxNode, scope: ReadonlyMap<string, string>) => {
        const nodeClass = classifyNode(node, table, domain);
        let nextScope = scope;

        if (nodeClass.type === "quantifier" && isVariableLabel(nodeClass.variable)) {
            const outer = scope.get(nodeClass.variable);
            if (outer) {
                const outerNode = binders.get(outer)?.node;
                diagnostics.push({
                    stage: "variables",
                    severity: "info",
                    code: "variables-shadowing",
                    title: `${node.label} vuelve a cuantificar ${nodeClass.variable}`,
                    reasoning: [
                        `${node.label} está dentro del alcance de ${outerNode?.label ?? nodeClass.variable}.`,
                        `El cuantificador más interno gobierna las apariciones de ${nodeClass.variable} dentro de su alcance; el externo no las alcanza.`,
                    ],
                    rule: formationRules.scope,
                    span: spans[node.id],
                    nodeId: node.id,
                });
            }
            binders.set(node.id, { node, variable: nodeClass.variable, uses: 0 });
            nextScope = new Map(scope).set(nodeClass.variable, node.id);
        } else if (nodeClass.type === "variable") {
            const binderId = scope.get(node.label);
            if (binderId) {
                const binder = binders.get(binderId);
                if (binder) binder.uses += 1;
            }
            occurrences.push({ name: node.label, nodeId: node.id, bound: Boolean(binderId), binderId });
        } else if (nodeClass.type === "assigned") {
            occurrences.push({
                name: nodeClass.variable,
                nodeId: node.id,
                bound: false,
                assignedValue: node.label,
            });
        }

        for (const child of node.children) {
            parents.set(child.id, node);
            visit(child, nextScope);
        }
    };

    visit(root, new Map());

    for (const binder of binders.values()) {
        if (binder.uses > 0) continue;
        const body = binder.node.children[0];
        diagnostics.push({
            stage: "variables",
            severity: "warning",
            code: "variables-vacuous-quantifier",
            title: `${binder.node.label} no liga ninguna aparición de ${binder.variable}`,
            reasoning: [
                body
                    ? `En su alcance, ${quote(formatFormula(body))}, no aparece ${binder.variable} libre.`
                    : `${binder.node.label} no tiene alcance.`,
                `La fórmula sigue bien formada, pero el cuantificador no tiene efecto: en un dominio no vacío ${binder.node.label} φ equivale a φ.`,
            ],
            rule: formationRules.scope,
            hint: "Revisa los paréntesis: quizá el alcance debía incluir más de la fórmula.",
            span: spans[binder.node.id],
            nodeId: binder.node.id,
        });
    }

    const names = [...new Set(occurrences.map(({ name }) => name))];
    for (const name of names) {
        const free = occurrences.filter((occurrence) => occurrence.name === name && !occurrence.bound && !occurrence.assignedValue);
        const bound = occurrences.filter((occurrence) => occurrence.name === name && occurrence.bound);
        const first = free[0];
        if (!first || bound.length === 0) continue;
        const binderNodes = [...new Set(bound.map(({ binderId }) => binderId))]
            .flatMap((id) => (id ? [binders.get(id)?.node] : []))
            .filter((node): node is SyntaxNode => Boolean(node));
        const container = enclosingAtom(first.nodeId, parents, table, domain);
        diagnostics.push({
            stage: "variables",
            severity: "warning",
            code: "variables-free-and-bound",
            title: `${name} aparece libre y también ligada`,
            reasoning: [
                `${bound.length === 1 ? "Una aparición" : `${bound.length} apariciones`} de ${name} ${bound.length === 1 ? "está ligada" : "están ligadas"} por ${binderNodes.map((node) => node.label).join(", ")}.`,
                ...binderNodes.map((node) => {
                    const body = node.children[0];
                    return `El alcance de ${node.label} es solo ${quote(body ? formatFormula(body) : "□")}.`;
                }),
                `La aparición de ${name}${container ? ` en ${quote(formatFormula(container))}` : ""} queda fuera de ese alcance: en su ruta hacia la raíz no hay ningún ∀${name} ni ∃${name}, así que es libre.`,
                `Por eso la fórmula es abierta y necesita un valor l(${name}) del entorno.`,
            ],
            rule: formationRules.scope,
            hint: `Si querías que el cuantificador abarcara esa aparición, encierra toda la subfórmula entre paréntesis: ${binderNodes[0]?.label ?? `∀${name}`}(…).`,
            span: spans[first.nodeId],
            nodeId: first.nodeId,
        });
    }

    const freeVariables = [...new Set(
        occurrences
            .filter(({ bound, assignedValue }) => !bound && !assignedValue)
            .map(({ name }) => name),
    )];
    return { occurrences, freeVariables, diagnostics };
}

export function classifyNode(
    node: SyntaxNode,
    table: SymbolTable,
    domain: ReadonlySet<string>,
): NodeClass {
    const label = node.label.trim();
    if (node.substitutedFor) return { type: "assigned", variable: node.substitutedFor };
    if (label === "¬" || isBinaryLabel(label)) return { type: "connective" };
    if (label === "↔" || label === "⇔") return { type: "unsupported" };
    const quantifier = label.match(/^([∀∃])\s*(.*)$/u);
    if (quantifier) {
        return { type: "quantifier", symbol: quantifier[1] ?? "∀", variable: quantifier[2] ?? "" };
    }
    if (label === "=") return { type: "equality" };
    const entry = table.get(label);
    if (entry) return { type: "symbol", entry };
    if (isVariableLabel(label)) return { type: "variable" };
    if (domain.has(label)) return { type: "domain" };
    if (placeholders.has(label)) return { type: "placeholder" };
    return { type: "unknown" };
}

function naturalCategory(nodeClass: NodeClass): Category | null {
    switch (nodeClass.type) {
        case "connective":
        case "quantifier":
        case "equality":
        case "unsupported":
            return "formula";
        case "symbol":
            return nodeClass.entry.category === "predicate" ? "formula" : "term";
        case "variable":
        case "assigned":
        case "domain":
            return "term";
        default:
            return null;
    }
}

function termNature(node: SyntaxNode, nodeClass: NodeClass): string {
    if (nodeClass.type === "variable") return "es una variable individual";
    if (nodeClass.type === "assigned") return `es el valor que el entorno asigna a ${nodeClass.variable}`;
    if (nodeClass.type === "domain") return `es el literal del elemento ${node.label} de D`;
    if (nodeClass.type === "symbol" && nodeClass.entry.arity === 0) return "es una constante";
    if (nodeClass.type === "symbol") return `es la aplicación del símbolo funcional ${node.label}`;
    return "es un término";
}

function formulaNature(node: SyntaxNode, nodeClass: NodeClass): string {
    if (nodeClass.type === "symbol") return `es una fórmula atómica formada con el predicado ${node.label}`;
    if (nodeClass.type === "equality") return "es una igualdad, es decir, una fórmula atómica";
    if (nodeClass.type === "quantifier") return `es una fórmula cuantificada con ${node.label}`;
    if (node.label === "¬") return "es una negación";
    return `es una fórmula compuesta con ${node.label}`;
}

function roleText(context: Context): string {
    const { parent, index } = context;
    if (!parent) return "como fórmula completa";
    if (parent.label === "¬") return "como operando de ¬";
    if (isBinaryLabel(parent.label)) return `como operando ${index === 0 ? "izquierdo" : "derecho"} de ${parent.label}`;
    if (/^[∀∃]/u.test(parent.label)) return `en el alcance de ${parent.label}`;
    if (parent.label === "=") return `como lado ${index === 0 ? "izquierdo" : "derecho"} de “=”`;
    return `como ${ordinal(index)} argumento de ${parent.label}`;
}

function ruleForFormulaSlot(parent: SyntaxNode | undefined): string {
    if (!parent) return `${formationRules.predicateAtom} ${formationRules.equalityAtom}`;
    if (parent.label === "¬") return formationRules.negation;
    if (/^[∀∃]/u.test(parent.label)) return formationRules.quantifier;
    return formationRules.binary;
}

function ruleForTermSlot(parent: SyntaxNode | undefined, table: SymbolTable): string {
    if (parent?.label === "=") return formationRules.equalityAtom;
    const entry = parent ? table.get(parent.label) : undefined;
    if (entry?.category === "function") return formationRules.functionTerm;
    return formationRules.predicateAtom;
}

function enclosingAtom(
    nodeId: string,
    parents: ReadonlyMap<string, SyntaxNode>,
    table: SymbolTable,
    domain: ReadonlySet<string>,
): SyntaxNode | null {
    let current = parents.get(nodeId);
    while (current) {
        const nodeClass = classifyNode(current, table, domain);
        if (nodeClass.type === "equality") return current;
        if (nodeClass.type === "symbol" && nodeClass.entry.category === "predicate") return current;
        current = parents.get(current.id);
    }
    return null;
}

function toSubscript(value: number): string {
    return [...String(value)].map((digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)] ?? digit).join("");
}
