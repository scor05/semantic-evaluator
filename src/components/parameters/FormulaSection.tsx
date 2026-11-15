import { FunctionSquare, Keyboard } from "lucide-react";
import type { RefObject } from "react";
import { operators } from "../../data/demo";
import { getValidationState, type FormulaValidation } from "../../domain/validation";
import { Section } from "../ui/Section";
import { ValidationSummary } from "../validation/ValidationSummary";
import "./formula-section.css";

type FormulaSectionProps = {
    formula: string;
    inputRef: RefObject<HTMLInputElement | null>;
    validation: FormulaValidation;
    onFormulaChange: (value: string) => void;
    onInsertOperator: (operator: string) => void;
    onOpenValidation: () => void;
};

export function FormulaSection({
    formula,
    inputRef,
    validation,
    onFormulaChange,
    onInsertOperator,
    onOpenValidation,
}: FormulaSectionProps) {
    const invalid = getValidationState(validation) === "invalid";
    return (
        <Section eyebrow="Fórmula" icon={<FunctionSquare size={18} />}>
            <label className="field-label" htmlFor="formula-input">
                Fórmula a evaluar
            </label>
            <div className="formula-input-wrap">
                <input
                    aria-describedby="formula-validation"
                    aria-invalid={invalid || undefined}
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
            <div id="formula-validation">
                <ValidationSummary onOpen={onOpenValidation} validation={validation} />
            </div>
        </Section>
    );
}
