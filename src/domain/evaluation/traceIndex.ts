import type { EvaluationTrace } from "./types";

/**
 * Chooses one coherent evaluation context for each syntax node. A quantified
 * body may be evaluated more than once, so we prefer its witness or
 * counterexample and otherwise use the first element from a complete scan.
 */
export function indexRelevantEvaluationTraces(root: EvaluationTrace): Map<string, EvaluationTrace> {
    const traces = new Map<string, EvaluationTrace>();

    const visit = (trace: EvaluationTrace) => {
        if (!traces.has(trace.nodeId)) traces.set(trace.nodeId, trace);

        for (const child of trace.children) visit(child.trace);

        const quantifier = trace.quantifier;
        if (!quantifier) return;
        const relevant = quantifier.checks.find(
            ({ element }) => element === quantifier.decisiveElement,
        ) ?? quantifier.checks[0];
        if (relevant) visit(relevant.trace);
    };

    visit(root);
    return traces;
}

export function isLogicalOperatorTrace(trace: EvaluationTrace): boolean {
    return trace.kind !== "atom";
}
