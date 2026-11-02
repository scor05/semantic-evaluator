import type { TreeNode } from "../types/logic";

export const operators = ["¬", "∧", "∨", "→", "∀", "∃", "(", ")"];

export const demoNodes: TreeNode[] = [
    { id: "forall", label: "∀x", kind: "quantifier", x: 50, y: 12 },
    { id: "implies", label: "→", kind: "connective", x: 50, y: 34 },
    { id: "p", label: "P(x)", kind: "predicate", x: 27, y: 60 },
    { id: "exists", label: "∃y", kind: "quantifier", x: 73, y: 60 },
    { id: "q", label: "Q(x, y)", kind: "predicate", x: 73, y: 84 },
];
