import type {
    FunctionDefinition,
    InterpretationError,
    PredicateDefinition,
} from "../types/logic";
import { cartesianPower } from "../utils/cartesianPower";

type InterpretationState = {
    domain: string[];
    functions: FunctionDefinition[];
    predicates: PredicateDefinition[];
    functionOutputs: Record<string, string>;
    predicateTuples: Record<string, string[]>;
};

export function getInterpretationErrors({
    domain,
    functions,
    predicates,
    functionOutputs,
    predicateTuples,
}: InterpretationState): InterpretationError[] {
    const functionErrors = functions.flatMap((definition) => {
        const invalidOutputs = cartesianPower(domain, definition.arity).flatMap((tuple) => {
            const tupleKey = tuple.join("|") || "constant";
            const output = functionOutputs[`${definition.id}:${tupleKey}`];
            return !output || !domain.includes(output) ? [output ?? ""] : [];
        });
        return invalidOutputs.length > 0
            ? [{
                symbol: definition.name || "f",
                kind: "function" as const,
                missingCount: invalidOutputs.length,
                reason: invalidOutputs.some(Boolean) ? "invalid" as const : "missing" as const,
            }]
            : [];
    });

    const predicateErrors = predicates.flatMap((predicate) => {
        const name = predicate.name.trim();
        const hasInterpretation = Object.prototype.hasOwnProperty.call(predicateTuples, name);
        const invalidTupleCount = (predicateTuples[name] ?? []).filter(
            (tuple) => !isValidPredicateTuple(tuple, predicate.arity, domain),
        ).length;
        return !hasInterpretation || invalidTupleCount > 0
            ? [{
                symbol: name || "P",
                kind: "predicate" as const,
                missingCount: Math.max(1, invalidTupleCount),
                reason: invalidTupleCount > 0 ? "invalid" as const : "missing" as const,
            }]
            : [];
    });

    return [...functionErrors, ...predicateErrors];
}

export function createDefaultFunctionOutputs(
    domain: string[],
    definitions: FunctionDefinition[],
): Record<string, string> {
    if (domain.length === 0) return {};
    const outputs: Record<string, string> = {};
    for (const definition of definitions) {
        for (const tuple of cartesianPower(domain, definition.arity)) {
            const tupleKey = tuple.join("|") || "constant";
            const outputIndex = tuple.reduce(
                (sum, value) => sum + Math.max(0, domain.indexOf(value)),
                0,
            ) % domain.length;
            outputs[`${definition.id}:${tupleKey}`] = domain[outputIndex] ?? domain[0] ?? "";
        }
    }
    return outputs;
}

function isValidPredicateTuple(tuple: string, arity: number, domain: string[]): boolean {
    const values = getPredicateTupleValues(tuple);
    return values.length === arity && values.every((value) => domain.includes(value));
}

export function getPredicateTupleValues(tuple: string): string[] {
    const normalized = tuple.trim().replace(/^\(|\)$/gu, "");
    return normalized ? normalized.split(",").map((value) => value.trim()) : [];
}
