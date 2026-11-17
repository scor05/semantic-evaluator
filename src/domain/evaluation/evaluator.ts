import { isVariableLabel, type SyntaxNode } from "../syntaxTree";
import { formatFormula } from "../validation/format";
import { tupleKey } from "./model";
import type {
    Binding,
    EvaluationResult,
    EvaluationTrace,
    FiniteInterpretation,
    QuantifierCheck,
    TraceChild,
} from "./types";

export class EvaluationError extends Error {}

type Environment = ReadonlyMap<string, string>;

const truth = (value: boolean) => (value ? "verdadera" : "falsa");

export function evaluateFormula(
    tree: SyntaxNode,
    interpretation: FiniteInterpretation,
    environment: Record<string, string | undefined>,
): EvaluationResult {
    if (interpretation.domain.length === 0) {
        throw new EvaluationError("El dominio está vacío.");
    }
    const assigned = new Map<string, string>();
    const root = restoreVariables(tree, assigned);
    const evaluator = new Evaluator(interpretation, root);
    const initial = new Map<string, string>();
    for (const variable of evaluator.freeVariables(root)) {
        const value = environment[variable]?.trim() || assigned.get(variable);
        if (!value || !interpretation.domain.includes(value)) {
            throw new EvaluationError(`La variable libre ${variable} no tiene un valor válido en el entorno.`);
        }
        initial.set(variable, value);
    }
    const trace = evaluator.formula(root, initial, "r");
    return {
        value: trace.value,
        trace,
        environment: [...initial].map(([variable, value]) => ({ variable, value })),
        decisiveChain: decisiveChain(trace),
    };
}

function restoreVariables(node: SyntaxNode, assigned: Map<string, string>): SyntaxNode {
    if (node.substitutedFor) {
        if (!assigned.has(node.substitutedFor)) assigned.set(node.substitutedFor, node.label);
        return { id: node.id, label: node.substitutedFor, kind: "term", children: [] };
    }
    return { ...node, children: node.children.map((child) => restoreVariables(child, assigned)) };
}

function decisiveChain(root: EvaluationTrace): EvaluationTrace[] {
    const chain: EvaluationTrace[] = [];
    let current: EvaluationTrace | undefined = root;
    while (current) {
        chain.push(current);
        const quantifier: EvaluationTrace["quantifier"] = current.quantifier;
        if (quantifier) {
            if (quantifier.mode === "complete") break;
            current = quantifier.checks.find(({ element }) => element === quantifier.decisiveElement)?.trace;
            continue;
        }
        const decisive: TraceChild[] = current.children.filter((child) => child.decisive);
        current = decisive.length === 1 ? decisive[0]?.trace : undefined;
    }
    return chain;
}

class Evaluator {
    private readonly freeCache = new Map<string, string[]>();

    constructor(
        private readonly interpretation: FiniteInterpretation,
        root: SyntaxNode,
    ) {
        this.freeVariables(root);
    }

    freeVariables(node: SyntaxNode): string[] {
        const cached = this.freeCache.get(node.id);
        if (cached) return cached;
        let result: string[];
        const quantifier = parseQuantifier(node.label);
        if (quantifier) {
            const [body] = node.children;
            result = body ? this.freeVariables(body).filter((name) => name !== quantifier.variable) : [];
        } else if (this.isVariableNode(node)) {
            result = [node.label];
        } else {
            result = [...new Set(node.children.flatMap((child) => this.freeVariables(child)))];
        }
        this.freeCache.set(node.id, result);
        return result;
    }

    formula(node: SyntaxNode, environment: Environment, id: string): EvaluationTrace {
        const quantifier = parseQuantifier(node.label);
        if (quantifier) return this.quantified(node, quantifier.symbol, quantifier.variable, environment, id);
        switch (node.label) {
            case "¬":
                return this.negation(node, environment, id);
            case "∧":
            case "∨":
            case "→":
                return this.binary(node, environment, id);
            case "=":
                return this.equality(node, environment, id);
            default:
                return this.atom(node, environment, id);
        }
    }

    private negation(node: SyntaxNode, environment: Environment, id: string): EvaluationTrace {
        const operand = this.formula(this.child(node, 0), environment, `${id}.0`);
        const value = !operand.value;
        return this.trace(node, environment, id, "not", value, {
            summary: `¬φ es ${truth(value)} porque φ = ${operand.formula} es ${truth(operand.value)}.`,
            children: [{ role: "Operando", decisive: true, trace: operand }],
        });
    }

    private binary(node: SyntaxNode, environment: Environment, id: string): EvaluationTrace {
        const left = this.formula(this.child(node, 0), environment, `${id}.0`);
        const right = this.formula(this.child(node, 1), environment, `${id}.1`);

        if (node.label === "∧") {
            const value = left.value && right.value;
            const summary = value
                ? "Ambos operandos son verdaderos, así que la conjunción es verdadera."
                : !left.value && !right.value
                    ? "Ambos operandos son falsos; basta uno falso para que la conjunción sea falsa."
                    : `El operando ${left.value ? "derecho" : "izquierdo"} es falso; basta uno falso para que la conjunción sea falsa.`;
            return this.trace(node, environment, id, "and", value, {
                summary,
                children: [
                    { role: "Izquierdo", decisive: value || !left.value, trace: left },
                    { role: "Derecho", decisive: value || (left.value && !right.value), trace: right },
                ],
            });
        }

        if (node.label === "∨") {
            const value = left.value || right.value;
            const summary = !value
                ? "Ambos operandos son falsos, así que la disyunción es falsa."
                : `El operando ${left.value ? "izquierdo" : "derecho"} es verdadero; basta uno verdadero para que la disyunción sea verdadera.`;
            return this.trace(node, environment, id, "or", value, {
                summary,
                children: [
                    { role: "Izquierdo", decisive: !value || left.value, trace: left },
                    { role: "Derecho", decisive: !value || (!left.value && right.value), trace: right },
                ],
            });
        }

        const value = !left.value || right.value;
        const summary = !value
            ? "El antecedente es verdadero y el consecuente es falso: es el único caso en que la implicación es falsa."
            : !left.value
                ? "El antecedente es falso, así que la implicación es verdadera sin importar el consecuente."
                : "El antecedente es verdadero y el consecuente también, así que la implicación es verdadera.";
        return this.trace(node, environment, id, "implies", value, {
            summary,
            children: [
                { role: "Antecedente", decisive: true, trace: left },
                { role: "Consecuente", decisive: left.value, trace: right },
            ],
        });
    }

    private quantified(
        node: SyntaxNode,
        symbol: "∀" | "∃",
        variable: string,
        environment: Environment,
        id: string,
    ): EvaluationTrace {
        const body = this.child(node, 0);
        const bodyText = formatFormula(body);
        const domain = this.interpretation.domain;
        const checks: QuantifierCheck[] = [];
        let decisiveElement: string | undefined;

        for (const element of domain) {
            const extended = new Map(environment).set(variable, element);
            const trace = this.formula(body, extended, `${id}.${variable}=${element}`);
            checks.push({ element, value: trace.value, trace });
            if ((symbol === "∃" && trace.value) || (symbol === "∀" && !trace.value)) {
                decisiveElement = element;
                break;
            }
        }

        const unchecked = domain.slice(checks.length);
        const size = domain.length;
        const elementsText = `${size} ${size === 1 ? "elemento" : "elementos"} de D = {${domain.join(", ")}}`;

        if (symbol === "∃") {
            const value = decisiveElement !== undefined;
            return this.trace(node, environment, id, "exists", value, {
                summary: value
                    ? `Testigo: con ${variable} = ${decisiveElement}, ${bodyText} es verdadera; basta un elemento para que ∃${variable} se cumpla.`
                    : `Comprobación completa: ${bodyText} es falsa para cada uno de los ${elementsText}; ningún testigo existe.`,
                quantifier: {
                    symbol,
                    variable,
                    mode: value ? "witness" : "complete",
                    decisiveElement,
                    checks,
                    unchecked,
                },
            });
        }

        const value = decisiveElement === undefined;
        return this.trace(node, environment, id, "forall", value, {
            summary: value
                ? `Comprobación completa: ${bodyText} es verdadera para cada uno de los ${elementsText}.`
                : `Contraejemplo: con ${variable} = ${decisiveElement}, ${bodyText} es falsa; basta un elemento para que ∀${variable} falle.`,
            quantifier: {
                symbol,
                variable,
                mode: value ? "complete" : "counterexample",
                decisiveElement,
                checks,
                unchecked,
            },
        });
    }

    private equality(node: SyntaxNode, environment: Environment, id: string): EvaluationTrace {
        const steps: string[] = [];
        const seen = new Set<string>();
        const left = this.term(this.child(node, 0), environment, steps, seen);
        const right = this.term(this.child(node, 1), environment, steps, seen);
        const value = left === right;
        steps.push(value ? `${left} = ${right}` : `${left} ≠ ${right}`);
        return this.trace(node, environment, id, "equality", value, {
            summary: value
                ? `Ambos lados denotan el mismo elemento, ${left}.`
                : `El lado izquierdo denota ${left} y el derecho ${right}: son elementos distintos.`,
            steps,
        });
    }

    private atom(node: SyntaxNode, environment: Environment, id: string): EvaluationTrace {
        const predicate = this.interpretation.predicates.get(node.label);
        if (!predicate) throw new EvaluationError(`${node.label} no es un predicado del lenguaje.`);
        const steps: string[] = [];
        const seen = new Set<string>();
        const values = node.children.map((child) => this.term(child, environment, steps, seen));
        const value = predicate.tuples.has(tupleKey(values));
        const tuple = values.length === 1 ? values[0] ?? "" : `(${values.join(", ")})`;
        const relation = `${predicate.name}ᴵ`;
        const membership = values.length === 0
            ? `${predicate.name} ${value ? "es verdadera" : "es falsa"} en la interpretación`
            : `${tuple} ${value ? "∈" : "∉"} ${relation}`;
        steps.push(membership);
        return this.trace(node, environment, id, "atom", value, {
            summary: values.length === 0
                ? `${membership}.`
                : `${membership}, así que ${formatFormula(node)} es ${truth(value)}.`,
            steps,
        });
    }

    private term(node: SyntaxNode, environment: Environment, steps: string[], seen: Set<string>): string {
        const model = this.interpretation.functions.get(node.label);
        if (model) {
            const args = node.children.map((child) => this.term(child, environment, steps, seen));
            const output = model.table.get(tupleKey(args));
            if (output === undefined) {
                throw new EvaluationError(`${model.name}ᴵ no está definida en (${args.join(", ")}).`);
            }
            const step = model.arity === 0
                ? `${model.name} = ${model.name}ᴵ = ${output}`
                : `${formatFormula(node)} = ${model.name}ᴵ(${args.join(", ")}) = ${output}`;
            if (!steps.includes(step)) steps.push(step);
            return output;
        }

        if (isVariableLabel(node.label)) {
            const value = environment.get(node.label);
            if (value === undefined) throw new EvaluationError(`${node.label} no tiene valor.`);
            if (!seen.has(node.label)) {
                seen.add(node.label);
                steps.push(`${node.label} ↦ ${value}`);
            }
            return value;
        }

        if (this.interpretation.domain.includes(node.label)) {
            return node.label;
        }

        throw new EvaluationError(`${node.label} no es un término del lenguaje.`);
    }

    private trace(
        node: SyntaxNode,
        environment: Environment,
        id: string,
        kind: EvaluationTrace["kind"],
        value: boolean,
        details: Partial<Pick<EvaluationTrace, "summary" | "steps" | "children" | "quantifier">>,
    ): EvaluationTrace {
        const bindings: Binding[] = this.freeVariables(node).flatMap((variable) => {
            const bound = environment.get(variable);
            return bound === undefined ? [] : [{ variable, value: bound }];
        });
        return {
            id,
            nodeId: node.id,
            kind,
            formula: formatFormula(node),
            value,
            bindings,
            summary: details.summary ?? "",
            steps: details.steps ?? [],
            children: details.children ?? [],
            quantifier: details.quantifier,
        };
    }

    private child(node: SyntaxNode, index: number): SyntaxNode {
        const child = node.children[index];
        if (!child) throw new EvaluationError(`${node.label} no tiene todos sus operandos.`);
        return child;
    }

    private isVariableNode(node: SyntaxNode): boolean {
        return node.children.length === 0
            && isVariableLabel(node.label)
            && !this.interpretation.functions.has(node.label)
            && !this.interpretation.predicates.has(node.label);
    }
}

function parseQuantifier(label: string): { symbol: "∀" | "∃"; variable: string } | null {
    const match = label.match(/^([∀∃])\s*(.+)$/u);
    if (!match) return null;
    return { symbol: match[1] === "∃" ? "∃" : "∀", variable: match[2] ?? "" };
}
