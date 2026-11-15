import type { SyntaxNode } from "../syntaxTree";
import { binaryConnectives } from "./rules";
import type { Span } from "./types";

const missing = "□";

export function isBinaryLabel(label: string): boolean {
    return (binaryConnectives as readonly string[]).includes(label);
}

export function formatFormula(node: SyntaxNode): string {
    return formatWithSpans(node).text;
}

export function formatWithSpans(root: SyntaxNode): {
    text: string;
    spans: Record<string, Span>;
} {
    const spans: Record<string, Span> = {};
    let text = "";

    const write = (value: string) => {
        text += value;
    };

    const visit = (node: SyntaxNode | undefined) => {
        if (!node) {
            write(missing);
            return;
        }
        const start = text.length;
        const [first, second, ...rest] = node.children;

        if (/^[∀∃]/u.test(node.label)) {
            write(node.label);
            if (first && !isBinaryLabel(first.label)) write(" ");
            visit(first);
            for (const extra of [second, ...rest].filter(Boolean)) {
                write(", ");
                visit(extra);
            }
        } else if (node.label === "¬") {
            write("¬");
            visit(first);
            for (const extra of [second, ...rest].filter(Boolean)) {
                write(", ");
                visit(extra);
            }
        } else if (isBinaryLabel(node.label) || node.label === "↔") {
            write("(");
            visit(first);
            write(` ${node.label} `);
            visit(second);
            for (const extra of rest) {
                write(` ${node.label} `);
                visit(extra);
            }
            write(")");
        } else if (node.label === "=" && node.children.length > 0) {
            visit(first);
            write(" = ");
            visit(second);
            for (const extra of rest) {
                write(" = ");
                visit(extra);
            }
        } else {
            write(node.label);
            if (node.children.length > 0) {
                write("(");
                node.children.forEach((child, index) => {
                    if (index > 0) write(", ");
                    visit(child);
                });
                write(")");
            }
        }

        spans[node.id] = { start, end: text.length };
    };

    visit(root);
    return { text, spans };
}
