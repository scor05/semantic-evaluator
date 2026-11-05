import { useEffect, useRef } from "react";

type PredicateTupleEditorProps = {
    arity: number;
    autoFocus?: boolean;
    errorMessage?: string;
    invalid?: boolean;
    predicateName: string;
    tupleIndex: number;
    value: string;
    onChange: (value: string) => void;
};

export function PredicateTupleEditor({
    arity,
    autoFocus = false,
    errorMessage,
    invalid = false,
    predicateName,
    tupleIndex,
    value,
    onChange,
}: PredicateTupleEditorProps) {
    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
    const slots = tupleToSlots(value, arity);

    useEffect(() => {
        if (!autoFocus) return;
        focusSlot(inputRefs.current, 0);
    }, [autoFocus]);

    const updateSlot = (slotIndex: number, nextValue: string) => {
        const nextSlots = [...slots];
        nextSlots[slotIndex] = nextValue;
        onChange(formatTuple(nextSlots));
    };

    const enterSymbol = (slotIndex: number, rawValue: string) => {
        const symbols = editableSymbols(rawValue);
        if (rawValue && symbols.length === 0) return;
        const symbol = symbols.at(-1) ?? "";
        updateSlot(slotIndex, symbol);
        if (symbol && slotIndex < arity - 1) {
            focusSlot(inputRefs.current, slotIndex + 1);
        }
    };

    const pasteSymbols = (slotIndex: number, pastedValue: string) => {
        const symbols = editableSymbols(pastedValue);
        if (symbols.length === 0) return;
        const nextSlots = [...slots];
        let lastUpdatedIndex = slotIndex;
        for (const symbol of symbols) {
            if (lastUpdatedIndex >= arity) break;
            nextSlots[lastUpdatedIndex] = symbol;
            lastUpdatedIndex += 1;
        }
        onChange(formatTuple(nextSlots));
        focusSlot(inputRefs.current, Math.min(lastUpdatedIndex, arity - 1));
    };

    return (
        <div
            aria-label={`Tupla ${tupleIndex + 1} de ${predicateName}`}
            aria-invalid={invalid || undefined}
            className={`tuple-editor ${invalid ? "has-interpretation-error" : ""}`}
            role="group"
            title={errorMessage}
        >
            <span aria-hidden="true" className="tuple-punctuation">(</span>
            {slots.map((slot, slotIndex) => (
                <span className="tuple-slot-group" key={slotIndex}>
                    {slotIndex > 0 && (
                        <span aria-hidden="true" className="tuple-punctuation">,</span>
                    )}
                    <input
                        aria-label={`Argumento ${slotIndex + 1} de la tupla ${tupleIndex + 1} de ${predicateName}`}
                        className="tuple-slot"
                        autoComplete="off"
                        inputMode="text"
                        onChange={(event) => enterSymbol(slotIndex, event.target.value)}
                        onFocus={(event) => event.currentTarget.select()}
                        onKeyDown={(event) => {
                            if (event.key === "Backspace" && !slot && slotIndex > 0) {
                                event.preventDefault();
                                updateSlot(slotIndex - 1, "");
                                focusSlot(inputRefs.current, slotIndex - 1);
                            } else if (event.key === "ArrowLeft" && slotIndex > 0) {
                                event.preventDefault();
                                focusSlot(inputRefs.current, slotIndex - 1);
                            } else if (event.key === "ArrowRight" && slotIndex < arity - 1) {
                                event.preventDefault();
                                focusSlot(inputRefs.current, slotIndex + 1);
                            }
                        }}
                        onPaste={(event) => {
                            event.preventDefault();
                            pasteSymbols(slotIndex, event.clipboardData.getData("text"));
                        }}
                        placeholder="·"
                        ref={(element) => {
                            inputRefs.current[slotIndex] = element;
                        }}
                        spellCheck={false}
                        value={slot}
                    />
                </span>
            ))}
            <span aria-hidden="true" className="tuple-punctuation">)</span>
        </div>
    );
}

function tupleToSlots(value: string, arity: number): string[] {
    if (arity <= 0) return [];
    const normalized = value.trim().replace(/^\(|\)$/gu, "");
    const values = normalized === "…"
        ? []
        : normalized.split(",").map((slot) => slot.trim());
    return Array.from(
        { length: arity },
        (_, index) => values[index] === "…" ? "" : [...(values[index] ?? "")].at(-1) ?? "",
    );
}

function formatTuple(slots: string[]): string {
    return `(${slots.join(", ")})`;
}

function editableSymbols(value: string): string[] {
    return [...value.replace(/[(),\s]/gu, "")].filter((symbol) => symbol !== "…");
}

function focusSlot(inputs: Array<HTMLInputElement | null>, index: number): void {
    const input = inputs[index];
    if (!input) return;
    input.focus();
    input.select();
}
