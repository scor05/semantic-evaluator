export { EvaluationError, evaluateFormula } from "./evaluator";
export { buildInterpretation } from "./model";
export { indexRelevantEvaluationTraces, isLogicalOperatorTrace } from "./traceIndex";
export type {
    Binding,
    EvaluationResult,
    EvaluationTrace,
    FiniteInterpretation,
    QuantifierCheck,
    QuantifierEvidence,
    TraceChild,
} from "./types";
