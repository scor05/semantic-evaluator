import { Braces, Plus, X } from "lucide-react";
import type { FunctionDefinition, PredicateDefinition } from "../../types/logic";
import { Section } from "../ui/Section";
import { DefinitionTable } from "./DefinitionTable";

type LanguageSectionProps = {
    domain: string[];
    domainDraft: string;
    functions: FunctionDefinition[];
    predicates: PredicateDefinition[];
    onDomainDraftChange: (value: string) => void;
    onAddDomainValue: () => void;
    onRemoveDomainValue: (value: string) => void;
    onAddFunction: () => void;
    onUpdateFunction: (id: number, field: "name" | "arity", value: string | number) => void;
    onRemoveFunction: (id: number) => void;
    onAddPredicate: () => void;
    onUpdatePredicate: (id: number, field: "name" | "arity", value: string | number) => void;
    onRemovePredicate: (id: number) => void;
};

export function LanguageSection({
    domain,
    domainDraft,
    functions,
    predicates,
    onDomainDraftChange,
    onAddDomainValue,
    onRemoveDomainValue,
    onAddFunction,
    onUpdateFunction,
    onRemoveFunction,
    onAddPredicate,
    onUpdatePredicate,
    onRemovePredicate,
}: LanguageSectionProps) {
    return (
        <Section eyebrow="Lenguaje" icon={<Braces size={18} />}>
            <label className="field-label" htmlFor="domain-value">
                Dominio
            </label>
            <div className="chip-input">
                <div className="chips">
                    {domain.map((value) => (
                        <span className="chip" key={value}>
                            {value}
                            <button
                                aria-label={`Eliminar ${value} del dominio`}
                                onClick={() => onRemoveDomainValue(value)}
                                type="button"
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
                <input
                    id="domain-value"
                    onChange={(event) => onDomainDraftChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            onAddDomainValue();
                        }
                    }}
                    placeholder="Agregar"
                    value={domainDraft}
                />
                <button
                    aria-label="Agregar al dominio"
                    className="input-action"
                    onClick={onAddDomainValue}
                    type="button"
                >
                    <Plus size={16} />
                </button>
            </div>

            <div className="subsection-title">
                <span>Símbolos funcionales</span>
                <span>{functions.length}</span>
            </div>
            <DefinitionTable
                addLabel="Nueva función"
                definitions={functions}
                kind="función"
                onAdd={onAddFunction}
                onChange={onUpdateFunction}
                onRemove={onRemoveFunction}
            />

            <div className="subsection-title predicate-title">
                <span>Predicados</span>
                <span>{predicates.length}</span>
            </div>
            <DefinitionTable
                addLabel="Nuevo predicado"
                definitions={predicates}
                kind="predicado"
                onAdd={onAddPredicate}
                onChange={onUpdatePredicate}
                onRemove={onRemovePredicate}
            />
        </Section>
    );
}
