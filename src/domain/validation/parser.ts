import { isVariableLabel, type SyntaxNode, type SyntaxNodeKind } from "../syntaxTree";
import { formatFormula, isBinaryLabel } from "./format";
import { describeToken, type Token, type TokenType } from "./lexer";
import { formationRules, quote } from "./rules";
import { describeSymbol, type SymbolTable } from "./signature";
import type { FormulaDiagnostic, Span } from "./types";

export type ParseResult = {
    tree: SyntaxNode | null;
    spans: Record<string, Span>;
    diagnostics: FormulaDiagnostic[];
};

class ParseFailure extends Error {
    constructor(readonly diagnostic: FormulaDiagnostic) {
        super(diagnostic.title);
    }
}

const binaryTypes: TokenType[] = ["and", "or", "implies"];
const gluedVariablePattern = /^([w-z](?:\d+|[₀-₉]+)?)(.+)$/u;

export function parseTokens(
    tokens: Token[],
    input: string,
    table: SymbolTable,
    domain: ReadonlySet<string>,
): ParseResult {
    const parser = new Parser([...tokens], input, table, domain);
    try {
        const tree = parser.parse();
        return {
            tree,
            spans: parser.spans,
            diagnostics: [...parser.notes, ...parser.precedenceNotes(tree)],
        };
    } catch (error) {
        if (!(error instanceof ParseFailure)) throw error;
        return { tree: null, spans: parser.spans, diagnostics: [...parser.notes, error.diagnostic] };
    }
}

class Parser {
    readonly spans: Record<string, Span> = {};
    readonly notes: FormulaDiagnostic[] = [];
    private readonly parenthesized = new Set<string>();
    private position = 0;
    private sequence = 0;

    constructor(
        private readonly tokens: Token[],
        private readonly input: string,
        private readonly table: SymbolTable,
        private readonly domain: ReadonlySet<string>,
    ) {}

    parse(): SyntaxNode {
        if (this.tokens.length === 0) {
            throw this.failure({
                code: "syntax-empty",
                title: "La fórmula está vacía",
                reasoning: [
                    "No hay ningún símbolo que analizar.",
                    "La cadena vacía no se obtiene con ninguna regla de formación, así que no es una fórmula.",
                ],
                rule: formationRules.closure,
            });
        }
        const root = this.parseImplication();
        if (!this.atEnd()) throw this.trailingFailure(this.peek());
        return root;
    }

    precedenceNotes(root: SyntaxNode): FormulaDiagnostic[] {
        const notes: FormulaDiagnostic[] = [];
        const visit = (node: SyntaxNode) => {
            if (isBinaryLabel(node.label)) {
                node.children.forEach((child, index) => {
                    if (!isBinaryLabel(child.label) || this.parenthesized.has(child.id)) return;
                    const sameOperator = child.label === node.label;
                    if (sameOperator && node.label !== "→") return;
                    const reading = formatFormula(child);
                    notes.push({
                        stage: "syntax",
                        severity: "info",
                        code: sameOperator ? "syntax-right-associative" : "syntax-implicit-grouping",
                        title: "Agrupación implícita por convención",
                        reasoning: sameOperator
                            ? [
                                "Hay dos → seguidos sin paréntesis.",
                                `Por convención → asocia a la derecha, así que se agrupó ${reading} como el consecuente.`,
                            ]
                            : [
                                `Sin paréntesis, ${child.label} liga más fuerte que ${node.label}.`,
                                `Por eso ${reading} se leyó como el ${index === 0 ? "operando izquierdo" : "operando derecho"} de ${node.label}.`,
                                "Precedencia usada: ¬ y cuantificadores > ∧ > ∨ > →.",
                            ],
                        rule: formationRules.binary,
                        hint: "Si querías otra agrupación, agrega paréntesis explícitos.",
                        span: this.spans[child.id],
                        nodeId: child.id,
                    });
                });
            }
            node.children.forEach(visit);
        };
        visit(root);
        return notes;
    }

    private parseImplication(): SyntaxNode {
        const left = this.parseDisjunction();
        if (this.peek()?.type !== "implies") return left;
        this.advance();
        const right = this.parseImplication();
        return this.binary("→", left, right);
    }

    private parseDisjunction(): SyntaxNode {
        let node = this.parseConjunction();
        while (this.peek()?.type === "or") {
            this.advance();
            node = this.binary("∨", node, this.parseConjunction());
        }
        return node;
    }

    private parseConjunction(): SyntaxNode {
        let node = this.parseUnary();
        while (this.peek()?.type === "and") {
            this.advance();
            node = this.binary("∧", node, this.parseUnary());
        }
        return node;
    }

    private parseUnary(): SyntaxNode {
        const token = this.peek();
        if (token?.type === "not") {
            this.advance();
            const operand = this.parseUnary();
            return this.node("¬", "connective", [operand], token.span.start, this.end(operand));
        }
        if (token?.type === "forall" || token?.type === "exists") return this.parseQuantifier();
        return this.parseAtom();
    }

    private parseQuantifier(): SyntaxNode {
        const quantifier = this.advance();
        const symbol = quantifier.text;
        let variable = this.peek();

        if (variable?.type !== "name") {
            throw this.failure({
                code: "syntax-quantifier-variable-missing",
                title: `${symbol} debe ir seguido de una variable`,
                reasoning: [
                    `Después de ${symbol} (columna ${quantifier.span.start + 1}) aparece ${describeToken(variable)}.`,
                    "Un cuantificador siempre liga una variable individual concreta: ∀x φ o ∃y φ.",
                ],
                rule: formationRules.quantifier,
                hint: `Escribe por ejemplo ${symbol}x seguido de la fórmula.`,
                span: quantifier.span,
            });
        }

        if (!isVariableLabel(variable.text)) {
            const glued = this.splitGluedVariable(variable);
            if (!glued) throw this.quantifierVariableFailure(symbol, variable);
            this.tokens.splice(this.position, 1, glued.variable, glued.rest);
            this.notes.push({
                stage: "syntax",
                severity: "info",
                code: "syntax-glued-quantifier",
                title: `${quote(`${symbol}${variable.text}`)} se separó en ${symbol}${glued.variable.text} ${glued.rest.text}`,
                reasoning: [
                    `${quote(variable.text)} no es una variable, pero empieza con la variable ${glued.variable.text} seguida del símbolo declarado ${glued.rest.text}.`,
                ],
                hint: `Escribe un espacio: ${symbol}${glued.variable.text} ${glued.rest.text}…`,
                span: variable.span,
            });
            variable = glued.variable;
        }

        this.advance();
        const bodyStart = this.peek();
        if (
            !bodyStart
            || bodyStart.type === "rparen"
            || bodyStart.type === "comma"
            || binaryTypes.includes(bodyStart.type)
        ) {
            throw this.failure({
                code: "syntax-quantifier-body-missing",
                title: `${symbol}${variable.text} no tiene fórmula en su alcance`,
                reasoning: [
                    `Después de ${symbol}${variable.text} aparece ${describeToken(bodyStart)}.`,
                    `La regla exige una fórmula φ inmediatamente después: ${symbol}${variable.text} φ.`,
                ],
                rule: formationRules.quantifier,
                hint: `Por ejemplo: ${symbol}${variable.text} P(${variable.text}).`,
                span: { start: quantifier.span.start, end: variable.span.end },
            });
        }

        const body = this.parseUnary();
        return this.node(
            `${symbol}${variable.text}`,
            "quantifier",
            [body],
            quantifier.span.start,
            this.end(body),
        );
    }

    private parseAtom(): SyntaxNode {
        const token = this.peek();
        if (token?.type === "lparen") return this.parseGroup();
        if (token?.type === "name") return this.parseAtomicFromName();
        throw this.expectedFormulaFailure(token);
    }

    private parseGroup(): SyntaxNode {
        const open = this.advance();
        if (this.peek()?.type === "rparen") {
            const close = this.peek();
            throw this.failure({
                code: "syntax-empty-parentheses",
                title: "Paréntesis vacíos",
                reasoning: [
                    `Los paréntesis de la columna ${open.span.start + 1} no encierran nada.`,
                    "Los paréntesis solo delimitan una fórmula ya formada; “()” no es una fórmula.",
                ],
                rule: formationRules.binary,
                span: { start: open.span.start, end: close?.span.end ?? open.span.end },
            });
        }
        const inner = this.parseImplication();
        const close = this.peek();
        if (close?.type !== "rparen") throw this.unclosedFailure(open, close, "group");
        this.advance();
        this.spans[inner.id] = { start: open.span.start, end: close.span.end };
        this.parenthesized.add(inner.id);
        return inner;
    }

    private parseAtomicFromName(): SyntaxNode {
        const left = this.parseApplication();
        if (this.peek()?.type !== "equals") return left;
        const equals = this.advance();
        const rightStart = this.peek();
        if (rightStart?.type !== "name") {
            throw this.failure({
                code: "syntax-equality-right-missing",
                title: "Falta el término derecho de “=”",
                reasoning: [
                    `La igualdad de la columna ${equals.span.start + 1} tiene a la izquierda ${quote(formatFormula(left))}.`,
                    `A la derecha se esperaba un término (variable, constante o f(t₁, …)), pero aparece ${describeToken(rightStart)}.`,
                ],
                rule: formationRules.equalityAtom,
                span: rightStart?.span ?? equals.span,
            });
        }
        const right = this.parseApplication();
        const chained = this.peek();
        if (chained?.type === "equals") {
            throw this.failure({
                code: "syntax-equality-chain",
                title: "La igualdad no se encadena",
                reasoning: [
                    `${quote(`${formatFormula(left)} = ${formatFormula(right)}`)} ya es una fórmula atómica.`,
                    "“=” solo puede ir entre dos términos; a su izquierda ahora habría una fórmula.",
                ],
                rule: formationRules.equalityAtom,
                hint: "Escribe (t₁ = t₂ ∧ t₂ = t₃).",
                span: chained.span,
            });
        }
        return this.node("=", "predicate", [left, right], this.start(left), this.end(right));
    }

    private parseApplication(): SyntaxNode {
        const name = this.advance();
        if (this.peek()?.type !== "lparen") {
            return this.node(name.text, this.leafKind(name.text), [], name.span.start, name.span.end);
        }

        const open = this.advance();
        if (this.peek()?.type === "rparen") {
            const close = this.peek();
            const entry = this.table.get(name.text);
            throw this.failure({
                code: "syntax-empty-arguments",
                title: `${name.text}() tiene la lista de argumentos vacía`,
                reasoning: [
                    entry
                        ? `${describeSymbol(entry)}.`
                        : `${quote(name.text)} va seguido de “()” sin argumentos.`,
                    entry && entry.arity === 0
                        ? "Los símbolos 0-arios se escriben solos, sin paréntesis."
                        : "Una aplicación f(t₁, …, tₙ) necesita al menos un término entre los paréntesis.",
                ],
                rule: formationRules.functionTerm,
                hint: entry?.arity === 0 ? `Escribe solo ${name.text}.` : undefined,
                span: { start: name.span.start, end: close?.span.end ?? open.span.end },
            });
        }

        const children: SyntaxNode[] = [];
        let close: Token | undefined;
        while (!close) {
            const argumentStart = this.peek();
            if (!argumentStart) throw this.unclosedFailure(open, argumentStart, "arguments", name.text);
            if (argumentStart.type === "comma" || argumentStart.type === "rparen") {
                throw this.failure({
                    code: "syntax-argument-missing",
                    title: `Falta un argumento en ${name.text}(…)`,
                    reasoning: [
                        `En la columna ${argumentStart.span.start + 1} se esperaba un término como ${children.length + 1}.º argumento de ${name.text}, pero aparece ${describeToken(argumentStart)}.`,
                        "Cada coma separa dos términos; no puede haber posiciones vacías.",
                    ],
                    rule: formationRules.functionTerm,
                    span: argumentStart.span,
                });
            }
            children.push(this.parseImplication());
            const separator = this.peek();
            if (separator?.type === "comma") {
                this.advance();
            } else if (separator?.type === "rparen") {
                close = this.advance();
            } else {
                throw this.unclosedFailure(open, separator, "arguments", name.text);
            }
        }

        return this.node(
            name.text,
            this.applicationKind(name.text),
            children,
            name.span.start,
            close.span.end,
        );
    }

    private splitGluedVariable(token: Token): { variable: Token; rest: Token } | null {
        const match = token.text.match(gluedVariablePattern);
        const variableText = match?.[1];
        const restText = match?.[2];
        if (!variableText || !restText || !this.table.has(restText)) return null;
        const middle = token.span.start + variableText.length;
        return {
            variable: { type: "name", text: variableText, span: { start: token.span.start, end: middle } },
            rest: { type: "name", text: restText, span: { start: middle, end: token.span.end } },
        };
    }

    private quantifierVariableFailure(symbol: string, token: Token): ParseFailure {
        const entry = this.table.get(token.text);
        if (entry && this.tokens[this.position + 1]?.type === "lparen") {
            return this.failure({
                code: "syntax-quantifier-variable-missing",
                title: `Falta la variable después de ${symbol}`,
                reasoning: [
                    `Después de ${symbol} aparece directamente ${token.text}(…), y ${describeSymbol(entry)}.`,
                    `Un cuantificador debe nombrar primero la variable que liga: ${symbol}x φ.`,
                ],
                rule: formationRules.quantifier,
                hint: `Por ejemplo: ${symbol}x ${token.text}(x${entry.arity > 1 ? ", …" : ""}).`,
                span: token.span,
            });
        }
        if (entry?.category === "predicate") {
            return this.failure({
                code: "syntax-second-order",
                title: `${symbol}${token.text} cuantifica un predicado`,
                reasoning: [
                    `${describeSymbol(entry)}, no una variable individual.`,
                    "En lógica de primer orden los cuantificadores solo recorren individuos del dominio.",
                    `Cuantificar sobre predicados (como ${symbol}P P(a)) es propio de la lógica de segundo orden.`,
                ],
                rule: formationRules.quantifier,
                hint: `Cuantifica una variable y úsala como argumento: ${symbol}x ${token.text}(x).`,
                span: token.span,
            });
        }
        if (entry) {
            return this.failure({
                code: "syntax-quantified-function",
                title: `${symbol}${token.text} cuantifica un símbolo funcional`,
                reasoning: [
                    `${describeSymbol(entry)}: su significado lo fija la interpretación y no puede variar.`,
                    "Solo las variables individuales pueden ir después de un cuantificador.",
                ],
                rule: formationRules.quantifier,
                hint: `Usa una variable: ${symbol}x.`,
                span: token.span,
            });
        }
        const letters = [...token.text];
        const severalVariables = letters.length > 1 && letters.every((letter) => isVariableLabel(letter));
        return this.failure({
            code: "syntax-quantifier-not-variable",
            title: `${quote(token.text)} no es una variable`,
            reasoning: severalVariables
                ? [
                    `${quote(token.text)} se lee como un solo nombre, no como varias variables.`,
                    "Cada cuantificador liga exactamente una variable.",
                ]
                : [
                    `Después de ${symbol} aparece ${quote(token.text)}, que no es una variable individual.`,
                    formationRules.variables,
                ],
            rule: formationRules.quantifier,
            hint: severalVariables
                ? `¿Querías ${letters.map((letter) => `${symbol}${letter}`).join("")}?`
                : `Usa una variable: ${symbol}x, ${symbol}y, ${symbol}z o ${symbol}w.`,
            span: token.span,
        });
    }

    private expectedFormulaFailure(token: Token | undefined): ParseFailure {
        const previous = this.tokens[this.position - 1];
        const found = describeToken(token);

        if (previous && binaryTypes.includes(previous.type)) {
            return this.failure({
                code: "syntax-right-operand-missing",
                title: `Falta la fórmula a la derecha de ${previous.text}`,
                reasoning: [
                    `${previous.text} (columna ${previous.span.start + 1}) es un conectivo binario: (φ ${previous.text} ψ).`,
                    token
                        ? `Después de él se esperaba la fórmula ψ, pero aparece ${found}.`
                        : "La fórmula termina antes de que aparezca ψ.",
                    ...(token && binaryTypes.includes(token.type)
                        ? ["Dos conectivos binarios no pueden ir seguidos."]
                        : []),
                ],
                rule: formationRules.binary,
                span: token?.span ?? previous.span,
            });
        }

        if (previous?.type === "not") {
            return this.failure({
                code: "syntax-negation-operand-missing",
                title: "¬ debe aplicarse a una fórmula",
                reasoning: [
                    `Después de ¬ (columna ${previous.span.start + 1}) aparece ${found}.`,
                    "La negación es unaria: necesita exactamente una fórmula φ a su derecha, ¬φ.",
                ],
                rule: formationRules.negation,
                span: token?.span ?? previous.span,
            });
        }

        if (token?.type === "rparen" && previous?.type !== "lparen") {
            return this.trailingFailure(token);
        }

        if (token && binaryTypes.includes(token.type)) {
            return this.failure({
                code: "syntax-left-operand-missing",
                title: `Falta la fórmula a la izquierda de ${token.text}`,
                reasoning: [
                    `${token.text} es un conectivo binario: necesita una fórmula a cada lado, (φ ${token.text} ψ).`,
                    previous?.type === "lparen"
                        ? `Justo después de “(” no hay ninguna fórmula φ.`
                        : "Antes de él no hay ninguna fórmula φ.",
                ],
                rule: formationRules.binary,
                span: token.span,
            });
        }

        if (token?.type === "equals") {
            return this.failure({
                code: "syntax-equality-left-missing",
                title: "Falta el término izquierdo de “=”",
                reasoning: [
                    "La igualdad compara dos términos: t₁ = t₂.",
                    "Aquí no hay ningún término antes de “=”.",
                ],
                rule: formationRules.equalityAtom,
                span: token.span,
            });
        }

        if (token?.type === "comma") {
            return this.failure({
                code: "syntax-stray-comma",
                title: "Coma fuera de lugar",
                reasoning: [
                    `En la columna ${token.span.start + 1} aparece una coma donde se esperaba una fórmula.`,
                    "Las comas solo separan los argumentos dentro de f(t₁, …, tₙ) o P(t₁, …, tₙ).",
                ],
                rule: formationRules.predicateAtom,
                span: token.span,
            });
        }

        return this.failure({
            code: "syntax-formula-expected",
            title: token ? `Se esperaba una fórmula y aparece ${found}` : "La fórmula está incompleta",
            reasoning: [
                token
                    ? `En la columna ${token.span.start + 1} debía empezar una fórmula.`
                    : "La entrada termina donde debía empezar una fórmula.",
                "Una fórmula empieza con ¬, ∀, ∃, “(”, un predicado o un término seguido de “=”.",
            ],
            rule: formationRules.closure,
            span: token?.span ?? (previous ? { start: previous.span.end, end: previous.span.end } : undefined),
        });
    }

    private unclosedFailure(
        open: Token,
        found: Token | undefined,
        context: "group" | "arguments",
        owner?: string,
    ): ParseFailure {
        const what = context === "group"
            ? "la subfórmula"
            : `la lista de argumentos de ${owner ?? "la aplicación"}`;
        if (!found) {
            return this.failure({
                code: "syntax-unclosed-parenthesis",
                title: `El “(” de la columna ${open.span.start + 1} nunca se cierra`,
                reasoning: [
                    `Ese paréntesis abre ${what}.`,
                    "La fórmula termina sin el “)” correspondiente, así que esa parte no está delimitada.",
                ],
                rule: context === "group" ? formationRules.binary : formationRules.functionTerm,
                hint: "Agrega el “)” que falta.",
                span: open.span,
            });
        }
        return this.failure({
            code: context === "group" ? "syntax-group-not-closed" : "syntax-argument-separator",
            title: context === "group"
                ? `Se esperaba “)” y aparece ${describeToken(found)}`
                : `Se esperaba “,” o “)” en los argumentos de ${owner ?? "la aplicación"}`,
            reasoning: [
                `El “(” de la columna ${open.span.start + 1} abre ${what}.`,
                context === "group"
                    ? `Lo leído hasta la columna ${found.span.start} ya es una fórmula completa; para continuar haría falta un conectivo binario (∧, ∨, →) o cerrar con “)”.`
                    : `Después de un argumento completo solo puede venir “,” (otro argumento) o “)” (fin de la lista), pero aparece ${describeToken(found)}.`,
                ...(found.type === "name" || found.type === "lparen" || found.type === "not" || found.type === "forall" || found.type === "exists"
                    ? ["Dos expresiones no pueden ir una junto a otra sin un conectivo o una coma entre ellas."]
                    : []),
            ],
            rule: context === "group" ? formationRules.binary : formationRules.functionTerm,
            span: found.span,
        });
    }

    private trailingFailure(token: Token | undefined): ParseFailure {
        const consumed = token ? this.input.slice(0, token.span.start).trim() : this.input.trim();
        if (token?.type === "rparen") {
            return this.failure({
                code: "syntax-unmatched-parenthesis",
                title: "“)” sin “(” correspondiente",
                reasoning: [
                    `En la columna ${token.span.start + 1} se cierra un paréntesis que nunca se abrió.`,
                    consumed ? `Antes de él ya se reconoció una expresión completa: ${quote(consumed)}.` : "No hay nada antes de él.",
                ],
                rule: formationRules.binary,
                hint: "Elimina ese “)” o agrega el “(” que falta.",
                span: token.span,
            });
        }
        if (token?.type === "comma") {
            return this.failure({
                code: "syntax-stray-comma",
                title: "Coma fuera de una lista de argumentos",
                reasoning: [
                    `La coma de la columna ${token.span.start + 1} no está dentro de f(…) ni de P(…).`,
                    "Las comas solo separan argumentos; dos fórmulas se unen con un conectivo.",
                ],
                rule: formationRules.predicateAtom,
                span: token.span,
            });
        }
        if (token?.type === "equals") {
            return this.failure({
                code: "syntax-equality-misplaced",
                title: "“=” fuera de lugar",
                reasoning: [
                    `Lo que está a la izquierda de “=” (${quote(consumed)}) no es un término simple.`,
                    "“=” solo puede ir entre dos términos; los paréntesis agrupan fórmulas, no términos.",
                ],
                rule: formationRules.equalityAtom,
                span: token.span,
            });
        }
        const rest = token ? this.input.slice(token.span.start).trim() : "";
        const shownRest = rest.length > 24 ? `${rest.slice(0, 23)}…` : rest;
        return this.failure({
            code: "syntax-trailing-input",
            title: `Sobra ${shownRest ? quote(shownRest) : describeToken(token)} después de una fórmula completa`,
            reasoning: [
                `Hasta la columna ${token?.span.start ?? this.input.length} ya se reconoció una expresión completa: ${quote(consumed)}.`,
                "Después de una fórmula completa solo puede venir un conectivo binario (∧, ∨, →) o el final.",
                "Dos fórmulas no pueden ir una junto a otra sin conectivo.",
            ],
            rule: formationRules.binary,
            hint: "Une las partes con ∧, ∨ o →, o revisa los paréntesis.",
            span: token ? { start: token.span.start, end: this.input.trimEnd().length } : undefined,
        });
    }

    private leafKind(label: string): SyntaxNodeKind {
        const entry = this.table.get(label);
        if (entry) return entry.category;
        if (isVariableLabel(label)) return "term";
        if (this.domain.has(label)) return "value";
        return "term";
    }

    private applicationKind(label: string): SyntaxNodeKind {
        const entry = this.table.get(label);
        if (entry) return entry.category;
        return /^\p{Lu}/u.test(label) ? "predicate" : "function";
    }

    private binary(label: string, left: SyntaxNode, right: SyntaxNode): SyntaxNode {
        return this.node(label, "connective", [left, right], this.start(left), this.end(right));
    }

    private node(
        label: string,
        kind: SyntaxNodeKind,
        children: SyntaxNode[],
        start: number,
        end: number,
    ): SyntaxNode {
        this.sequence += 1;
        const id = `parsed-${this.sequence}`;
        this.spans[id] = { start, end };
        return { id, label, kind, children };
    }

    private start(node: SyntaxNode): number {
        return this.spans[node.id]?.start ?? 0;
    }

    private end(node: SyntaxNode): number {
        return this.spans[node.id]?.end ?? 0;
    }

    private failure(diagnostic: Omit<FormulaDiagnostic, "stage" | "severity">): ParseFailure {
        return new ParseFailure({ stage: "syntax", severity: "error", ...diagnostic });
    }

    private peek(): Token | undefined {
        return this.tokens[this.position];
    }

    private advance(): Token {
        const token = this.tokens[this.position];
        if (!token) throw new Error("Unexpected end of tokens");
        this.position += 1;
        return token;
    }

    private atEnd(): boolean {
        return this.position >= this.tokens.length;
    }
}
