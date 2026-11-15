import type { FunctionDefinition, PredicateDefinition } from "../../types/logic";
import { cartesianPower } from "../../utils/cartesianPower";
import { getPredicateTupleValues } from "../interpretation";
import type { FiniteInterpretation, FunctionModel, PredicateModel } from "./types";

type InterpretationInput = {
    domain: string[];
    functions: FunctionDefinition[];
    predicates: PredicateDefinition[];
    functionOutputs: Record<string, string>;
    predicateTuples: Record<string, string[]>;
};

export function tupleKey(values: readonly string[]): string {
    return values.join("|");
}

export function buildInterpretation({
    domain,
    functions,
    predicates,
    functionOutputs,
    predicateTuples,
}: InterpretationInput): FiniteInterpretation {
    const functionModels = new Map<string, FunctionModel>();
    for (const definition of functions) {
        const name = definition.name.trim();
        if (!name || functionModels.has(name)) continue;
        const table = new Map<string, string>();
        for (const tuple of cartesianPower(domain, definition.arity)) {
            const output = functionOutputs[`${definition.id}:${tuple.join("|") || "constant"}`];
            if (output !== undefined) table.set(tupleKey(tuple), output);
        }
        functionModels.set(name, { name, arity: definition.arity, table });
    }

    const predicateModels = new Map<string, PredicateModel>();
    for (const definition of predicates) {
        const name = definition.name.trim();
        if (!name || predicateModels.has(name)) continue;
        const tuples = new Set(
            (predicateTuples[definition.name] ?? []).map((tuple) => tupleKey(getPredicateTupleValues(tuple))),
        );
        predicateModels.set(name, { name, arity: definition.arity, tuples });
    }

    return { domain, functions: functionModels, predicates: predicateModels };
}
