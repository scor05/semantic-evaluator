export type FunctionModel = {
    name: string;
    arity: number;
    table: ReadonlyMap<string, string>;
};

export type PredicateModel = {
    name: string;
    arity: number;
    tuples: ReadonlySet<string>;
};

export type FiniteInterpretation = {
    domain: string[];
    functions: ReadonlyMap<string, FunctionModel>;
    predicates: ReadonlyMap<string, PredicateModel>;
};

export type Binding = {
    variable: string;
    value: string;
};

export type TraceKind =
    | "atom"
    | "equality"
    | "not"
    | "and"
    | "or"
    | "implies"
    | "forall"
    | "exists";

export type TraceChild = {
    role: string;
    decisive: boolean;
    trace: EvaluationTrace;
};

export type QuantifierMode = "witness" | "counterexample" | "complete";

export type QuantifierCheck = {
    element: string;
    value: boolean;
    trace: EvaluationTrace;
};

export type QuantifierEvidence = {
    symbol: "∀" | "∃";
    variable: string;
    mode: QuantifierMode;
    decisiveElement?: string;
    checks: QuantifierCheck[];
    unchecked: string[];
};

export type EvaluationTrace = {
    id: string;
    nodeId: string;
    kind: TraceKind;
    formula: string;
    value: boolean;
    bindings: Binding[];
    summary: string;
    steps: string[];
    children: TraceChild[];
    quantifier?: QuantifierEvidence;
};

export type EvaluationResult = {
    value: boolean;
    trace: EvaluationTrace;
    environment: Binding[];
    decisiveChain: EvaluationTrace[];
};
