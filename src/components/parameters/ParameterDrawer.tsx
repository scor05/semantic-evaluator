import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import "../../styles/shared-controls.css";
import "./drawer-actions.css";
import "./parameter-drawer.css";

type ParameterDrawerProps = {
    open: boolean;
    children: ReactNode;
    onToggle: () => void;
    onClear: () => void;
    contentRef?: RefObject<HTMLDivElement | null>;
};

export function ParameterDrawer({
    open,
    children,
    onToggle,
    onClear,
    contentRef,
}: ParameterDrawerProps) {
    return (
        <aside className={`parameter-drawer ${open ? "open" : "closed"}`}>
            <button
                aria-label={open ? "Cerrar parámetros" : "Abrir parámetros"}
                className="drawer-toggle"
                onClick={onToggle}
                type="button"
            >
                {open ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>

            <div className="drawer-content" ref={contentRef}>
                <header className="drawer-header">
                    <div>
                        <span className="eyebrow">Parámetros</span>
                    </div>
                </header>
                {children}
                <div className="drawer-actions">
                    <button className="secondary-action" onClick={onClear} type="button">
                        Limpiar
                    </button>
                </div>
            </div>
        </aside>
    );
}
