export const connectives = ["¬", "∧", "∨", "→"] as const;
export const binaryConnectives = ["∧", "∨", "→"] as const;

export const formationRules = {
    variableTerm: "Toda variable individual es un término.",
    constantTerm: "Toda constante individual (símbolo funcional 0-ario) es un término.",
    functionTerm:
        "Si f es un símbolo funcional n-ario y t₁, …, tₙ son términos, entonces f(t₁, …, tₙ) es un término. Nada más es término.",
    predicateAtom:
        "Si P es un predicado n-ario y t₁, …, tₙ son términos, entonces P(t₁, …, tₙ) es una fórmula atómica.",
    equalityAtom: "Si t₁ y t₂ son términos, entonces t₁ = t₂ es una fórmula atómica.",
    negation: "Si φ es una fórmula, entonces ¬φ es una fórmula.",
    binary: "Si φ y ψ son fórmulas, entonces (φ ∧ ψ), (φ ∨ ψ) y (φ → ψ) son fórmulas.",
    quantifier:
        "Si φ es una fórmula y x es una variable, entonces ∀x φ y ∃x φ son fórmulas. Los cuantificadores solo se aplican a variables individuales.",
    closure: "Solo son fórmulas las expresiones obtenidas con las reglas atómicas y recursivas.",
    alphabet:
        "Los símbolos lógicos son: variables, ¬, ∧, ∨, →, ∀, ∃, =, ( y ). Los no lógicos (funciones y predicados) deben declararse en el lenguaje.",
    variables:
        "Las variables individuales se escriben w, x, y, z, opcionalmente con subíndice (x₁, y2, …).",
    scope:
        "El alcance de ∀x o ∃x es su subfórmula inmediata. Una aparición de x es libre si en su ruta hacia la raíz no hay ningún ∀x ni ∃x.",
    environment:
        "Un entorno l: V → D asigna a cada variable libre un elemento del dominio; sin él una fórmula abierta no tiene valor de verdad.",
    domain: "El dominio del discurso D debe ser finito y no vacío.",
    signature:
        "Cada símbolo no lógico tiene una única categoría (función o predicado) y una aridad fija.",
} as const;

export function arityName(arity: number): string {
    switch (arity) {
        case 0:
            return "0-ario";
        case 1:
            return "unario";
        case 2:
            return "binario";
        case 3:
            return "ternario";
        default:
            return `${arity}-ario`;
    }
}

export function argumentCount(count: number): string {
    return count === 1 ? "1 argumento" : `${count} argumentos`;
}

export function ordinal(index: number): string {
    const names = ["primer", "segundo", "tercer", "cuarto", "quinto", "sexto"];
    return names[index] ?? `${index + 1}.º`;
}

export function quote(value: string): string {
    return `“${value}”`;
}
