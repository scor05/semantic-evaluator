import { Plus, Settings2, X } from "lucide-react";
import { useState } from "react";
import type {
    FunctionInterpretation,
    PredicateDefinition,
} from "../../types/logic";
import { getPredicateTupleValues } from "../../domain/interpretation";
import "../../styles/shared-controls.css";
import { Section } from "../ui/Section";
import { PredicateTupleEditor } from "./PredicateTupleEditor";
import "./interpretation-section.css";

type InterpretationSectionProps = {
    domain: string[];
    functions: FunctionInterpretation[];
    functionOutputs: Record<string, string>;
    predicates: PredicateDefinition[];
    predicateTuples: Record<string, string[]>;
    freeVariables: string[];
    environmentValues: Record<string, string>;
    onFunctionOutputChange: (key: string, value: string) => void;
    onPredicateTupleChange: (name: string, index: number, value: string) => void;
    onAddPredicateTuple: (predicate: PredicateDefinition) => void;
    onRemovePredicateTuple: (name: string, index: number) => void;
    onEnvironmentChange: (variable: string, value: string) => void;
};

export function InterpretationSection({
    domain,
    functions,
    functionOutputs,
    predicates,
    predicateTuples,
    freeVariables,
    environmentValues,
    onFunctionOutputChange,
    onPredicateTupleChange,
    onAddPredicateTuple,
    onRemovePredicateTuple,
    onEnvironmentChange,
}: InterpretationSectionProps) {
    const [tupleToFocus, setTupleToFocus] = useState<string | null>(null);

    return (
        <Section eyebrow="Interpretación" icon={<Settings2 size={18} />}>
            <div className="interpretation-group">
                <div className="subsection-title interpretation-subsection-title">
                    <span>Funciones</span>
                    <span>{functions.length}</span>
                </div>
                {functions.length > 0 ? (
                    <div className="function-mappings">
                        {functions.map(({ definition, inputs, inputCount }) => (
                            <div className="mapping-card" key={definition.id}>
                                <div className="mapping-card-heading">
                                    <div>
                                        <strong>{definition.name || "f"}</strong>
                                    </div>
                                    <span className="arity-badge">
                                        D<sup>{definition.arity}</sup> → D
                                    </span>
                                </div>
                                <div className="mapping-header">
                                    <span>Entrada</span>
                                    <span>Salida</span>
                                </div>
                                <div className="mapping-scroll">
                                    {inputs.map((tuple) => {
                                        const tupleKey = tuple.join("|") || "constant";
                                        const outputKey = `${definition.id}:${tupleKey}`;
                                        const output = functionOutputs[outputKey] ?? "";
                                        const hasOutputError = !output || !domain.includes(output);
                                        return (
                                            <div className="mapping-row" key={tupleKey}>
                                                <code>({tuple.join(", ")})</code>
                                                <select
                                                    aria-label={`Salida de ${definition.name || "función"} para (${tuple.join(", ")})`}
                                                    aria-invalid={hasOutputError || undefined}
                                                    className={hasOutputError ? "has-interpretation-error" : ""}
                                                    onChange={(event) =>
                                                        onFunctionOutputChange(outputKey, event.target.value)
                                                    }
                                                    title={hasOutputError
                                                        ? output
                                                            ? `“${output}” no pertenece al dominio.`
                                                            : "Selecciona una salida."
                                                        : undefined}
                                                    value={output}
                                                >
                                                    <option value="">—</option>
                                                    {output && !domain.includes(output) && (
                                                        <option value={output}>{output}</option>
                                                    )}
                                                    {domain.map((value) => (
                                                        <option key={value} value={value}>
                                                            {value}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>
                                {inputCount > inputs.length && (
                                    <div className="row-overflow">
                                        + {inputCount - inputs.length} entradas más
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="inline-empty">Declara una función para interpretarla.</div>
                )}
            </div>

            <div className="interpretation-group">
                <div className="subsection-title interpretation-subsection-title">
                    <span>Relaciones</span>
                </div>
                <div className="relation-grid">
                    {predicates.map((predicate) => {
                        const tuples = predicateTuples[predicate.name] ?? [];
                        return (
                            <div className="relation-card" key={predicate.id}>
                                <strong>{predicate.name || "P"}</strong>
                                {tuples.map((tuple, index) => {
                                    const tupleId = `${predicate.id}:${index}`;
                                    const tupleError = getPredicateTupleError(
                                        tuple,
                                        predicate.arity,
                                        domain,
                                    );
                                    return (
                                        <div className="tuple-row" key={tupleId}>
                                            <div className="tuple-field">
                                                <PredicateTupleEditor
                                                    arity={predicate.arity}
                                                    autoFocus={tupleToFocus === tupleId}
                                                    errorMessage={tupleError ?? undefined}
                                                    invalid={Boolean(tupleError)}
                                                    onChange={(value) =>
                                                        onPredicateTupleChange(
                                                            predicate.name,
                                                            index,
                                                            value,
                                                        )
                                                    }
                                                    predicateName={predicate.name || "P"}
                                                    tupleIndex={index}
                                                    value={tuple}
                                                />
                                                {tupleError && (
                                                    <small className="tuple-error-message" role="alert">
                                                        {tupleError}
                                                    </small>
                                                )}
                                            </div>
                                            <button
                                                aria-label="Eliminar tupla"
                                                className="icon-button subtle"
                                                onClick={() =>
                                                    onRemovePredicateTuple(predicate.name, index)
                                                }
                                                type="button"
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    );
                                })}
                                <button
                                    className="tiny-add"
                                    onClick={() => {
                                        setTupleToFocus(`${predicate.id}:${tuples.length}`);
                                        onAddPredicateTuple(predicate);
                                    }}
                                    type="button"
                                >
                                    <Plus size={13} /> Agregar
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="interpretation-group">
                <div className="subsection-title interpretation-subsection-title">
                    <span>Entorno</span>
                    <span>{freeVariables.length}</span>
                </div>
                {freeVariables.length > 0 ? (
                    <div className="environment-card">
                        {freeVariables.map((variable) => {
                            const selectedValue = environmentValues[variable] ?? "";
                            const hasEnvironmentError = !selectedValue
                                || !domain.includes(selectedValue);
                            return (
                                <label key={variable}>
                                    <code>{variable} ↦</code>
                                    <select
                                        aria-label={`Valor de la variable libre ${variable}`}
                                        aria-invalid={hasEnvironmentError || undefined}
                                        className={hasEnvironmentError ? "has-interpretation-error" : ""}
                                        value={selectedValue}
                                        title={hasEnvironmentError
                                            ? selectedValue
                                                ? `“${selectedValue}” no pertenece al dominio.`
                                                : "Selecciona un valor para la variable libre."
                                            : undefined}
                                        onChange={(event) =>
                                            onEnvironmentChange(variable, event.target.value)
                                        }
                                    >
                                        <option value="">—</option>
                                        {selectedValue && !domain.includes(selectedValue) && (
                                            <option value={selectedValue}>{selectedValue}</option>
                                        )}
                                        {domain.map((value) => (
                                            <option key={value} value={value}>
                                                {value}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            );
                        })}
                    </div>
                ) : (
                    <div className="inline-empty environment-empty">No hay variables libres</div>
                )}
            </div>
        </Section>
    );
}

function getPredicateTupleError(
    tuple: string,
    arity: number,
    domain: string[],
): string | null {
    const values = getPredicateTupleValues(tuple);
    if (values.length !== arity || values.some((value) => !value)) {
        return "Completa todos los argumentos.";
    }
    const invalidValues = [...new Set(values.filter((value) => !domain.includes(value)))];
    return invalidValues.length > 0
        ? `Fuera del dominio: ${invalidValues.join(", ")}`
        : null;
}
