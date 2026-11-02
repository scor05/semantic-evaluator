import { Plus, X } from "lucide-react";
import type { SymbolDefinition } from "../../types/logic";
import "../../styles/shared-controls.css";
import { ArityStepper } from "./ArityStepper";
import "./definition-table.css";

type DefinitionTableProps = {
    definitions: SymbolDefinition[];
    kind: "función" | "predicado";
    addLabel: string;
    onChange: (id: number, field: "name" | "arity", value: string | number) => void;
    onAdd: () => void;
    onRemove: (id: number) => void;
};

export function DefinitionTable({
    definitions,
    kind,
    addLabel,
    onChange,
    onAdd,
    onRemove,
}: DefinitionTableProps) {
    return (
        <div className="definition-block">
            <div className="table-header" aria-hidden="true">
                <span>Símbolo</span>
                <span>Aridad</span>
                <span />
            </div>
            {definitions.map((definition) => (
                <div className="definition-row" key={definition.id}>
                    <input
                        aria-label={`${kind} ${definition.id}`}
                        className="symbol-input"
                        maxLength={12}
                        value={definition.name}
                        onChange={(event) => onChange(definition.id, "name", event.target.value)}
                    />
                    <ArityStepper
                        label={`Aridad de ${definition.name || kind}`}
                        onChange={(value) => onChange(definition.id, "arity", value)}
                        value={definition.arity}
                    />
                    <button
                        aria-label={`Eliminar ${definition.name || kind}`}
                        className="icon-button subtle"
                        onClick={() => onRemove(definition.id)}
                        type="button"
                    >
                        <X size={15} />
                    </button>
                </div>
            ))}
            <button className="add-row" onClick={onAdd} type="button">
                <Plus size={15} /> {addLabel}
            </button>
        </div>
    );
}
