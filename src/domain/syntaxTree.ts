export type SyntaxNodeKind =
    | "quantifier"
    | "connective"
    | "predicate"
    | "function"
    | "value"
    | "term";

export type SyntaxNode = {
    id: string;
    label: string;
    kind: SyntaxNodeKind;
    children: SyntaxNode[];
    substitutedFor?: string;
};

export type SyntaxLanguageSymbols = {
    functions?: Iterable<string>;
    predicates?: Iterable<string>;
    values?: Iterable<string>;
};

export type SyntaxSymbolRole =
    | "variable"
    | "value"
    | "predicate"
    | "function"
    | "logical";

export function classifySyntaxSymbol(
    symbol: string,
    language: SyntaxLanguageSymbols = {},
): SyntaxSymbolRole | null {
    if (isVariableLabel(symbol)) return "variable";
    if (new Set(language.values ?? []).has(symbol)) return "value";
    if (new Set(language.predicates ?? []).has(symbol)) return "predicate";
    if (new Set(language.functions ?? []).has(symbol)) return "function";
    if (["¬", "∧", "∨", "→", "↔", "=", "φ"].includes(symbol)) return "logical";
    if (/^[∀∃][w-z]$/u.test(symbol)) return "logical";
    return null;
}

let editNodeSequence = 0;

export function createSyntaxNode(
    label: string,
    kind: SyntaxNodeKind = "term",
    children: SyntaxNode[] = [],
): SyntaxNode {
    editNodeSequence += 1;
    return {
        id: `edit-${Date.now().toString(36)}-${editNodeSequence.toString(36)}`,
        label,
        kind,
        children,
    };
}

function tokenize(expression: string): string[] {
    return expression.match(/<->|↔|->|→|[∀∃¬∧∨=(),.]|[A-Za-z_][A-Za-z0-9_]*|[^\s]/gu) ?? [];
}

class LooseExpressionParser {
    private position = 0;
    private nodeSequence = 0;
    private readonly functionSymbols: Set<string>;
    private readonly predicateSymbols: Set<string>;
    private readonly values: Set<string>;

    constructor(private readonly tokens: string[], language: SyntaxLanguageSymbols) {
        this.functionSymbols = new Set(language.functions ?? []);
        this.predicateSymbols = new Set(language.predicates ?? []);
        this.values = new Set(language.values ?? []);
    }

    parse(): SyntaxNode {
        if (this.tokens.length === 0) return this.node("φ", "term");

        let root = this.parseImplication();
        while (!this.atEnd()) {
            const token = this.consume();
            if (token === ")" || token === ",") continue;
            root = this.node(token, "connective", [root, this.parseUnary()]);
        }
        return root;
    }

    private parseImplication(): SyntaxNode {
        const left = this.parseDisjunction();
        if (this.match("→", "->", "↔", "<->")) {
            const operator = this.previous();
            return this.node(operator === "->" ? "→" : operator === "<->" ? "↔" : operator, "connective", [
                left,
                this.parseImplication(),
            ]);
        }
        return left;
    }

    private parseDisjunction(): SyntaxNode {
        let node = this.parseConjunction();
        while (this.match("∨")) {
            node = this.node("∨", "connective", [node, this.parseConjunction()]);
        }
        return node;
    }

    private parseConjunction(): SyntaxNode {
        let node = this.parseUnary();
        while (this.match("∧")) {
            node = this.node("∧", "connective", [node, this.parseUnary()]);
        }
        return node;
    }

    private parseUnary(): SyntaxNode {
        if (this.match("¬")) {
            return this.node("¬", "connective", [this.parseUnary()]);
        }

        if (this.match("∀", "∃")) {
            const quantifier = this.previous();
            const variable = this.peekIdentifier() ? this.consume() : "x";
            return this.node(`${quantifier}${variable}`, "quantifier", [this.parseUnary()]);
        }

        return this.parsePrimary();
    }

    private parsePrimary(): SyntaxNode {
        if (this.match("(")) {
            const expression = this.parseImplication();
            this.match(")");
            return expression;
        }

        if (this.atEnd() || this.peek() === ")" || this.peek() === ",") {
            return this.node("?", "term");
        }

        const label = this.consume();
        if (this.match("(")) {
            const children: SyntaxNode[] = [];
            while (!this.atEnd() && this.peek() !== ")") {
                children.push(this.parseImplication());
                if (!this.match(",")) break;
            }
            this.match(")");
            const kind = this.configuredKind(label)
                ?? (/^[A-Z]/u.test(label) ? "predicate" : "function");
            return this.node(label, kind, children);
        }

        if (this.match("=")) {
            return this.node("=", "predicate", [this.node(label, "term"), this.parsePrimary()]);
        }

        return this.node(label, this.configuredKind(label) ?? "term");
    }

    private node(label: string, kind: SyntaxNodeKind, children: SyntaxNode[] = []): SyntaxNode {
        this.nodeSequence += 1;
        return {
            id: `parsed-${this.nodeSequence}`,
            label,
            kind,
            children,
        };
    }

    private match(...tokens: string[]): boolean {
        if (!tokens.includes(this.peek())) return false;
        this.position += 1;
        return true;
    }

    private consume(): string {
        const token = this.tokens[this.position] ?? "?";
        this.position += 1;
        return token;
    }

    private previous(): string {
        return this.tokens[this.position - 1] ?? "?";
    }

    private peek(): string {
        return this.tokens[this.position] ?? "";
    }

    private peekIdentifier(): boolean {
        return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(this.peek());
    }

    private configuredKind(label: string): "function" | "predicate" | "value" | null {
        if (this.predicateSymbols.has(label)) return "predicate";
        if (this.functionSymbols.has(label)) return "function";
        if (this.values.has(label)) return "value";
        return null;
    }

    private atEnd(): boolean {
        return this.position >= this.tokens.length;
    }
}

export function parseExpression(
    expression: string,
    language: SyntaxLanguageSymbols = {},
): SyntaxNode {
    return new LooseExpressionParser(tokenize(expression), language).parse();
}

export function findSyntaxNode(root: SyntaxNode, nodeId: string): SyntaxNode | null {
    if (root.id === nodeId) return root;
    for (const child of root.children) {
        const match = findSyntaxNode(child, nodeId);
        if (match) return match;
    }
    return null;
}

export function getSyntaxNodes(root: SyntaxNode): SyntaxNode[] {
    return [root, ...root.children.flatMap(getSyntaxNodes)];
}

export function renameSyntaxNode(
    root: SyntaxNode,
    nodeId: string,
    label: string,
    kind?: SyntaxNodeKind,
): SyntaxNode {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) return root;
    if (root.id === nodeId) {
        if (root.substitutedFor && isVariableLabel(normalizedLabel)) {
            return {
                ...root,
                label: normalizedLabel,
                kind: "term",
                substitutedFor: undefined,
            };
        }
        return {
            ...root,
            label: normalizedLabel,
            kind: root.substitutedFor ? "value" : kind ?? root.kind,
        };
    }
    return {
        ...root,
        children: root.children.map((child) =>
            renameSyntaxNode(child, nodeId, normalizedLabel, kind)
        ),
    };
}

export function trackSyntaxNodeSubstitution(
    root: SyntaxNode,
    nodeId: string,
    variable: string,
): SyntaxNode {
    if (root.id === nodeId) {
        return {
            ...root,
            kind: "value",
            substitutedFor: variable,
        };
    }
    return {
        ...root,
        children: root.children.map((child) =>
            trackSyntaxNodeSubstitution(child, nodeId, variable)
        ),
    };
}

export function clearSyntaxNodeSubstitution(
    root: SyntaxNode,
    nodeId: string,
    kind: SyntaxNodeKind,
): SyntaxNode {
    if (root.id === nodeId) {
        return {
            ...root,
            kind,
            substitutedFor: undefined,
        };
    }
    return {
        ...root,
        children: root.children.map((child) =>
            clearSyntaxNodeSubstitution(child, nodeId, kind)
        ),
    };
}

export function addSyntaxChild(
    root: SyntaxNode,
    nodeId: string,
    label = "x",
    kind?: SyntaxNodeKind,
): SyntaxNode {
    if (root.id === nodeId) {
        return {
            ...root,
            children: [...root.children, createSyntaxNode(label, kind ?? inferSyntaxNodeKind(label))],
        };
    }
    return {
        ...root,
        children: root.children.map((child) => addSyntaxChild(child, nodeId, label, kind)),
    };
}

export function wrapSyntaxNode(
    root: SyntaxNode,
    nodeId: string,
    label = "¬",
    kind?: SyntaxNodeKind,
): SyntaxNode {
    if (root.id === nodeId) {
        return createSyntaxNode(label, kind ?? inferSyntaxNodeKind(label), [root]);
    }
    return {
        ...root,
        children: root.children.map((child) => wrapSyntaxNode(child, nodeId, label, kind)),
    };
}

export function inferSyntaxNodeKind(label: string): SyntaxNodeKind {
    if (/^[∀∃]/u.test(label)) return "quantifier";
    if (["¬", "∧", "∨", "→", "↔"].includes(label)) return "connective";
    if (/^[A-Z]/u.test(label)) return "predicate";
    if (/^[a-z][A-Za-z0-9_]*$/u.test(label) && label.length > 1) return "function";
    return "term";
}

export function getFreeVariables(root: SyntaxNode): string[] {
    const freeVariables = new Set<string>();

    const visit = (node: SyntaxNode, boundVariables: ReadonlySet<string>) => {
        if (
            node.kind === "term"
            && isVariableLabel(node.label)
            && !boundVariables.has(node.label)
        ) {
            freeVariables.add(node.label);
        }

        const quantifiedVariable = getQuantifiedVariable(node);
        if (!quantifiedVariable) {
            for (const child of node.children) visit(child, boundVariables);
            return;
        }

        const nextBoundVariables = new Set(boundVariables);
        nextBoundVariables.add(quantifiedVariable);
        for (const child of node.children) visit(child, nextBoundVariables);
    };

    visit(root, new Set());
    return [...freeVariables];
}

export function getEnvironmentNodeIds(root: SyntaxNode): string[] {
    const nodeIds = new Set<string>();

    const visit = (node: SyntaxNode, boundVariables: ReadonlySet<string>) => {
        if (
            node.substitutedFor
            || (
                node.kind === "term"
                && isVariableLabel(node.label)
                && !boundVariables.has(node.label)
            )
        ) {
            nodeIds.add(node.id);
        }

        const quantifiedVariable = getQuantifiedVariable(node);
        const nextBoundVariables = quantifiedVariable
            ? new Set([...boundVariables, quantifiedVariable])
            : boundVariables;
        for (const child of node.children) visit(child, nextBoundVariables);
    };

    visit(root, new Set());
    return [...nodeIds];
}

export function substituteFreeVariable(
    root: SyntaxNode,
    variable: string,
    replacement: string,
): SyntaxNode {
    const normalizedVariable = variable.trim();
    const normalizedReplacement = replacement.trim();
    if (!normalizedVariable) return root;

    const substitute = (node: SyntaxNode, boundVariables: ReadonlySet<string>): SyntaxNode => {
        if (node.substitutedFor === normalizedVariable) {
            return normalizedReplacement
                ? { ...node, label: normalizedReplacement, kind: "value" }
                : { ...node, label: normalizedVariable, kind: "term", substitutedFor: undefined };
        }

        if (
            node.kind === "term"
            && Boolean(normalizedReplacement)
            && node.label === normalizedVariable
            && !boundVariables.has(normalizedVariable)
        ) {
            return {
                ...node,
                label: normalizedReplacement,
                kind: "value",
                substitutedFor: normalizedVariable,
            };
        }

        const quantifiedVariable = getQuantifiedVariable(node);
        const nextBoundVariables = quantifiedVariable
            ? new Set([...boundVariables, quantifiedVariable])
            : boundVariables;
        return {
            ...node,
            children: node.children.map((child) => substitute(child, nextBoundVariables)),
        };
    };

    return substitute(root, new Set());
}

export function getSubstitutedVariables(root: SyntaxNode): string[] {
    const variables = new Set<string>();
    const visit = (node: SyntaxNode) => {
        if (node.substitutedFor) variables.add(node.substitutedFor);
        for (const child of node.children) visit(child);
    };
    visit(root);
    return [...variables];
}

export function getSubstitutionValues(root: SyntaxNode): Record<string, string[]> {
    const values: Record<string, string[]> = {};
    const visit = (node: SyntaxNode) => {
        if (node.substitutedFor) {
            const variableValues = values[node.substitutedFor] ?? [];
            if (!variableValues.includes(node.label)) variableValues.push(node.label);
            values[node.substitutedFor] = variableValues;
        }
        for (const child of node.children) visit(child);
    };
    visit(root);
    return values;
}

function getQuantifiedVariable(node: SyntaxNode): string | null {
    if (node.kind !== "quantifier") return null;
    return node.label.match(/^[∀∃]\s*([A-Za-z_][A-Za-z0-9_]*)$/u)?.[1] ?? null;
}

export function isVariableLabel(label: string): boolean {
    return /^[w-z]$/u.test(label);
}

export function removeSyntaxNode(root: SyntaxNode, nodeId: string): SyntaxNode {
    if (root.id === nodeId) return createSyntaxNode("φ");
    return {
        ...root,
        children: root.children
            .filter((child) => child.id !== nodeId)
            .map((child) => removeSyntaxNode(child, nodeId)),
    };
}

export function serializeSyntaxTree(node: SyntaxNode): string {
    const children = node.children.map(serializeSyntaxTree);

    if (node.kind === "quantifier") {
        const body = children[0] ?? "φ";
        return `${node.label}(${body})`;
    }

    if (node.kind === "predicate" || node.kind === "function") {
        return children.length > 0 ? `${node.label}(${children.join(", ")})` : node.label;
    }

    if (node.kind === "connective") {
        if (node.label === "¬") return `¬${children[0] ?? "φ"}`;
        if (children.length === 1) return `${node.label}${children[0]}`;
        if (children.length >= 2) return `(${children.join(` ${node.label} `)})`;
    }

    return children.length > 0 ? `${node.label}(${children.join(", ")})` : node.label;
}
