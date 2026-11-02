import { Plus, Settings2, X } from "lucide-react";
import type {
    FunctionInterpretation,
    PredicateDefinition,
} from "../../types/logic";
import "../../styles/shared-controls.css";
import { Section } from "../ui/Section";
import "./interpretation-section.css";

type InterpretationSectionProps = {
    domain: string[];
    functions: FunctionInterpretation[];
    functionOutputs: Record<string, string>;
    predicates: PredicateDefinition[];
    predicateTuples: Record<string, string[]>;
    hasFreeVariables: boolean;
    environmentValue: string;
    onFunctionOutputChange: (key: string, value: string) => void;
    onPredicateTupleChange: (name: string, index: number, value: string) => void;
    onAddPredicateTuple: (predicate: PredicateDefinition) => void;
    onRemovePredicateTuple: (name: string, index: number) => void;
    onToggleFreeVariables: () => void;
    onEnvironmentChange: (value: string) => void;
};

export function InterpretationSection({
    domain,
    functions,
    functionOutputs,
    predicates,
    predicateTuples,
    hasFreeVariables,
    environmentValue,
    onFunctionOutputChange,
    onPredicateTupleChange,
    onAddPredicateTuple,
    onRemovePredicateTuple,
    onToggleFreeVariables,
    onEnvironmentChange,
}: InterpretationSectionProps) {
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
                                        return (
                                            <div className="mapping-row" key={tupleKey}>
                                                <code>({tuple.join(", ")})</code>
                                                <select
                                                    aria-label={`Salida de ${definition.name || "función"} para (${tuple.join(", ")})`}
                                                    onChange={(event) =>
                                                        onFunctionOutputChange(outputKey, event.target.value)
                                                    }
                                                    value={functionOutputs[outputKey] ?? ""}
                                                >
                                                    <option value="">—</option>
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
                    {predicates.map((predicate) => (
                        <div className="relation-card" key={predicate.id}>
                            <strong>{predicate.name || "P"}</strong>
                            {(predicateTuples[predicate.name] ?? []).map((tuple, index) => (
                                <div className="tuple-row" key={`${tuple}-${index}`}>
                                    <input
                                        aria-label={`Tupla ${index + 1} de ${predicate.name}`}
                                        value={tuple}
                                        onChange={(event) =>
                                            onPredicateTupleChange(
                                                predicate.name,
                                                index,
                                                event.target.value,
                                            )
                                        }
                                    />
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
                            ))}
                            <button
                                className="tiny-add"
                                onClick={() => onAddPredicateTuple(predicate)}
                                type="button"
                            >
                                <Plus size={13} /> Agregar
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="interpretation-group">
                <div className="subsection-title interpretation-subsection-title">
                    <span>Entorno</span>
                    <button
                        aria-label="Alternar variables libres"
                        aria-pressed={hasFreeVariables}
                        className="subsection-state-toggle"
                        onClick={onToggleFreeVariables}
                        type="button"
                    />
                </div>
                {hasFreeVariables ? (
                    <div className="environment-card">
                        <label>
                            <code>y ↦</code>
                            <select
                                aria-label="Valor de la variable libre y"
                                value={environmentValue}
                                onChange={(event) => onEnvironmentChange(event.target.value)}
                            >
                                {domain.map((value) => (
                                    <option key={value} value={value}>
                                        {value}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                ) : (
                    <div className="inline-empty environment-empty">No hay variables libres</div>
                )}
            </div>
        </Section>
    );
}
