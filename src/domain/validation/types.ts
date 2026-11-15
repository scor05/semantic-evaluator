import type { SyntaxNode } from "../syntaxTree";

export type Span = {
    start: number;
    end: number;
};

export type ValidationStage =
    | "language"
    | "lexical"
    | "syntax"
    | "symbols"
    | "arity"
    | "category"
    | "variables"
    | "environment";

export type DiagnosticSeverity = "error" | "warning" | "info";

export type FormulaDiagnostic = {
    stage: ValidationStage;
    severity: DiagnosticSeverity;
    code: string;
    title: string;
    reasoning: string[];
    rule?: string;
    hint?: string;
    span?: Span;
    nodeId?: string;
};

export type StageStatus = "passed" | "failed" | "warning" | "skipped";

export type StageReport = {
    stage: ValidationStage;
    title: string;
    status: StageStatus;
    summary: string;
};

export type SignatureSymbol = {
    name: string;
    arity: number;
};

export type LanguageSignature = {
    functions: SignatureSymbol[];
    predicates: SignatureSymbol[];
    domain: string[];
};

export type VariableOccurrence = {
    name: string;
    nodeId: string;
    bound: boolean;
    binderId?: string;
    assignedValue?: string;
};

export type FormulaValidation = {
    source: "text" | "tree";
    input: string;
    ok: boolean;
    tree: SyntaxNode | null;
    reading: string | null;
    spans: Record<string, Span>;
    diagnostics: FormulaDiagnostic[];
    stages: StageReport[];
    freeVariables: string[];
    occurrences: VariableOccurrence[];
};
