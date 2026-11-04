export type SymbolDefinition = {
    id: number;
    name: string;
    arity: number;
};

export type FunctionDefinition = SymbolDefinition;
export type PredicateDefinition = SymbolDefinition;

export type FunctionInterpretation = {
    definition: FunctionDefinition;
    inputs: string[][];
    inputCount: number;
};

export type DemonstrationResult = boolean | null;

export type InterpretationError = {
    symbol: string;
    kind: "function" | "predicate";
    missingCount: number;
};
