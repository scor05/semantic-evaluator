import { FunctionSquare, Keyboard } from "lucide-react";
import type { RefObject } from "react";
import { operators } from "../../data/demo";
import { Section } from "../ui/Section";
import "./formula-section.css";

type FormulaSectionProps = {
    formula: string;
    inputRef: RefObject<HTMLInputElement | null>;
    onFormulaChange: (value: string) => void;
    onInsertOperator: (operator: string) => void;
};

export function FormulaSection({
    formula,
    inputRef,
    onFormulaChange,
    onInsertOperator,
}: FormulaSectionProps) {
    return (
        <Section eyebrow="Fórmula" icon={<FunctionSquare size={18} />}>
            <label className="field-label" htmlFor="formula-input">
                Fórmula a evaluar
            </label>
            <div className="formula-input-wrap">
                <input
                    id="formula-input"
                    ref={inputRef}
                    spellCheck={false}
                    value={formula}
                    onChange={(event) => onFormulaChange(event.target.value)}
                />
                <Keyboard size={17} />
            </div>
            <div className="operator-grid" aria-label="Símbolos lógicos">
                {operators.map((operator) => (
                    <button
                        key={operator}
                        onClick={() => onInsertOperator(operator)}
                        type="button"
                    >
                        {operator}
                    </button>
                ))}
            </div>
        </Section>
    );
}
