import type { SyntaxNode } from "../syntaxTree";
import { formatWithSpans, formatFormula } from "./format";
import { lex } from "./lexer";
import { parseTokens } from "./parser";
import { formationRules, quote } from "./rules";
import { buildSymbolTable } from "./signature";
import { analyzeVariables, checkTree } from "./treeChecks";
import type {
    FormulaDiagnostic,
    FormulaValidation,
    LanguageSignature,
    Span,
    StageReport,
    StageStatus,
    ValidationStage,
    VariableOccurrence,
} from "./types";

export type EnvironmentValues = Record<string, string | undefined>;

export const stageTitles: Record<ValidationStage, string> = {
    language: "Lenguaje y dominio",
    lexical: "Análisis léxico",
    syntax: "Análisis sintáctico",
    symbols: "Símbolos declarados",
    arity: "Aridades",
    category: "Términos y fórmulas",
    variables: "Variables y alcance",
    environment: "Entorno",
};

const stageOrder = Object.keys(stageTitles) as ValidationStage[];

type Analysis = {
    source: "text" | "tree";
    input: string;
    tree: SyntaxNode | null;
    spans: Record<string, Span>;
    diagnostics: FormulaDiagnostic[];
    tokenCount?: number;
    occurrences: VariableOccurrence[];
    freeVariables: string[];
};

export function validateFormulaText(
    input: string,
    signature: LanguageSignature,
    environment?: EnvironmentValues,
): FormulaValidation {
    const { table, diagnostics: signatureDiagnostics } = buildSymbolTable(signature);
    const domain = new Set(signature.domain);
    const lexed = lex(input);
    const analysis: Analysis = {
        source: "text",
        input,
        tree: null,
        spans: {},
        diagnostics: [...signatureDiagnostics, ...lexed.diagnostics],
        tokenCount: lexed.tokens.length,
        occurrences: [],
        freeVariables: [],
    };

    if (hasErrors(lexed.diagnostics)) return finish(analysis, signature, environment);

    const parsed = parseTokens(lexed.tokens, input, table, domain);
    analysis.diagnostics.push(...parsed.diagnostics);
    analysis.spans = parsed.spans;
    analysis.tree = parsed.tree;
    if (!parsed.tree) return finish(analysis, signature, environment);

    return finish(analyzeTree(analysis, parsed.tree, table, domain), signature, environment);
}

export function validateSyntaxTree(
    tree: SyntaxNode,
    signature: LanguageSignature,
    environment?: EnvironmentValues,
): FormulaValidation {
    const { table, diagnostics: signatureDiagnostics } = buildSymbolTable(signature);
    const domain = new Set(signature.domain);
    const formatted = formatWithSpans(tree);
    const analysis: Analysis = {
        source: "tree",
        input: formatted.text,
        tree,
        spans: formatted.spans,
        diagnostics: [...signatureDiagnostics],
        occurrences: [],
        freeVariables: [],
    };
    return finish(analyzeTree(analysis, tree, table, domain), signature, environment);
}

export function hasErrors(diagnostics: FormulaDiagnostic[]): boolean {
    return diagnostics.some(({ severity }) => severity === "error");
}

export function firstError(validation: FormulaValidation): FormulaDiagnostic | undefined {
    for (const stage of stageOrder) {
        const match = validation.diagnostics.find(
            (diagnostic) => diagnostic.stage === stage && diagnostic.severity === "error",
        );
        if (match) return match;
    }
    return undefined;
}

function analyzeTree(
    analysis: Analysis,
    tree: SyntaxNode,
    table: ReturnType<typeof buildSymbolTable>["table"],
    domain: ReadonlySet<string>,
): Analysis {
    analysis.diagnostics.push(...checkTree(tree, table, domain, analysis.spans));
    const variables = analyzeVariables(tree, table, domain, analysis.spans);
    analysis.diagnostics.push(...variables.diagnostics);
    analysis.occurrences = variables.occurrences;
    analysis.freeVariables = variables.freeVariables;
    return analysis;
}

function finish(
    analysis: Analysis,
    signature: LanguageSignature,
    environment: EnvironmentValues | undefined,
): FormulaValidation {
    const blocking = hasErrors(analysis.diagnostics);
    if (analysis.tree && environment && !blocking) {
        analysis.diagnostics.push(...checkEnvironment(analysis, signature, environment));
    }

    const diagnostics = sortDiagnostics(analysis.diagnostics);
    return {
        source: analysis.source,
        input: analysis.input,
        ok: !hasErrors(diagnostics),
        tree: analysis.tree,
        reading: analysis.tree ? formatFormula(analysis.tree) : null,
        spans: analysis.spans,
        diagnostics,
        stages: buildStages(analysis, diagnostics, signature, environment, blocking),
        freeVariables: analysis.freeVariables,
        occurrences: analysis.occurrences,
    };
}

function checkEnvironment(
    analysis: Analysis,
    signature: LanguageSignature,
    environment: EnvironmentValues,
): FormulaDiagnostic[] {
    const domain = new Set(signature.domain);
    const diagnostics: FormulaDiagnostic[] = [];
    const pending = [...new Set(
        analysis.occurrences
            .filter(({ bound, assignedValue }) => !bound && !assignedValue)
            .map(({ name }) => name),
    )];

    for (const variable of pending) {
        const occurrence = analysis.occurrences.find(({ name, bound }) => name === variable && !bound);
        const value = environment[variable]?.trim() ?? "";
        if (value && domain.has(value)) continue;
        diagnostics.push({
            stage: "environment",
            severity: "error",
            code: value ? "environment-value-outside-domain" : "environment-missing",
            title: value
                ? `l(${variable}) = ${value} no pertenece a D`
                : `La variable libre ${variable} no tiene valor en el entorno`,
            reasoning: value
                ? [
                    `El entorno asigna ${quote(value)} a ${variable}.`,
                    `Ese valor no está en D = {${signature.domain.join(", ")}}.`,
                ]
                : [
                    `${variable} aparece libre: ningún ∀${variable} ni ∃${variable} la liga.`,
                    `Para decidir la verdad de una fórmula abierta hace falta saber qué individuo denota ${variable}, es decir, l(${variable}) ∈ D.`,
                    "Hasta que se asigne, la fórmula no recibe valor de verdad.",
                ],
            rule: formationRules.environment,
            hint: `Elige un valor para ${variable} en la sección Entorno.`,
            span: occurrence ? analysis.spans[occurrence.nodeId] : undefined,
            nodeId: occurrence?.nodeId,
        });
    }
    return diagnostics;
}

function buildStages(
    analysis: Analysis,
    diagnostics: FormulaDiagnostic[],
    signature: LanguageSignature,
    environment: EnvironmentValues | undefined,
    blockingBeforeEnvironment: boolean,
): StageReport[] {
    const parseBlocked = !analysis.tree;
    const reading = analysis.tree ? formatFormula(analysis.tree) : "";
    const free = analysis.freeVariables;

    return stageOrder.map((stage) => {
        const own = diagnostics.filter((diagnostic) => diagnostic.stage === stage);
        const errors = own.filter(({ severity }) => severity === "error");
        const warnings = own.filter(({ severity }) => severity === "warning");
        const title = stageTitles[stage];

        if (errors.length > 0) {
            const extra = errors.length > 1 ? ` (+${errors.length - 1})` : "";
            return report(stage, title, "failed", `${errors[0]?.title ?? "Error"}${extra}`);
        }

        const skipped = skippedReason(stage, analysis, parseBlocked, environment, blockingBeforeEnvironment);
        if (skipped) return report(stage, title, "skipped", skipped);

        const status: StageStatus = warnings.length > 0 ? "warning" : "passed";
        return report(stage, title, status, passedSummary(stage, analysis, signature, reading, free, warnings.length));
    });
}

function skippedReason(
    stage: ValidationStage,
    analysis: Analysis,
    parseBlocked: boolean,
    environment: EnvironmentValues | undefined,
    blockingBeforeEnvironment: boolean,
): string | null {
    if (stage === "language") return null;
    if (stage === "lexical") {
        return analysis.source === "tree" ? "No aplica: la fórmula se editó directamente en el árbol." : null;
    }
    if (stage === "syntax" && analysis.source === "text" && analysis.tokenCount !== undefined && parseBlocked) {
        return "No se analizó porque hay símbolos fuera del alfabeto.";
    }
    if (parseBlocked && stage !== "syntax") return "No se revisó: primero debe existir un árbol sintáctico válido.";
    if (stage === "environment") {
        if (blockingBeforeEnvironment) return "No se revisó porque la fórmula tiene errores.";
        if (!environment) return "No se proporcionó entorno.";
    }
    return null;
}

function passedSummary(
    stage: ValidationStage,
    analysis: Analysis,
    signature: LanguageSignature,
    reading: string,
    free: string[],
    warnings: number,
): string {
    const observations = warnings > 0 ? ` · ${warnings} ${warnings === 1 ? "observación" : "observaciones"}` : "";
    switch (stage) {
        case "language":
            return `${signature.functions.length} ${signature.functions.length === 1 ? "función" : "funciones"}, ${signature.predicates.length} ${signature.predicates.length === 1 ? "predicado" : "predicados"} y |D| = ${signature.domain.length}.`;
        case "lexical":
            return `${analysis.tokenCount ?? 0} símbolos reconocidos del alfabeto.`;
        case "syntax":
            return `Bien formada. Lectura: ${reading}`;
        case "symbols":
            return "Cada símbolo es una variable, un símbolo lógico o está declarado.";
        case "arity":
            return "Cada aplicación tiene tantos argumentos como su aridad.";
        case "category":
            return "Los argumentos son términos y los operandos son fórmulas.";
        case "variables":
            return (free.length > 0
                ? `Fórmula abierta; ${free.length === 1 ? "variable libre" : "variables libres"}: ${free.join(", ")}.`
                : "Fórmula cerrada (enunciado): no necesita entorno.") + observations;
        case "environment":
            return free.length > 0
                ? "Cada variable libre tiene un valor en D."
                : "No se necesita entorno.";
    }
}

function report(stage: ValidationStage, title: string, status: StageStatus, summary: string): StageReport {
    return { stage, title, status, summary };
}

function sortDiagnostics(diagnostics: FormulaDiagnostic[]): FormulaDiagnostic[] {
    const severityRank = { error: 0, warning: 1, info: 2 } as const;
    return diagnostics
        .map((diagnostic, index) => ({ diagnostic, index }))
        .sort((a, b) =>
            severityRank[a.diagnostic.severity] - severityRank[b.diagnostic.severity]
            || stageOrder.indexOf(a.diagnostic.stage) - stageOrder.indexOf(b.diagnostic.stage)
            || (a.diagnostic.span?.start ?? 0) - (b.diagnostic.span?.start ?? 0)
            || a.index - b.index
        )
        .map(({ diagnostic }) => diagnostic);
}

export type ValidationState = "empty" | "invalid" | "incomplete" | "valid";

export function getValidationState(validation: FormulaValidation): ValidationState {
    if (validation.source === "text" && !validation.input.trim()) return "empty";
    const errors = validation.diagnostics.filter(({ severity }) => severity === "error");
    if (errors.some(({ stage }) => stage !== "environment")) return "invalid";
    return errors.length > 0 ? "incomplete" : "valid";
}
