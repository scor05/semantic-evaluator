import type { ReactNode } from "react";
import "../../styles/shared-controls.css";
import "../parameters/parameter-section.css";

type SectionProps = {
    eyebrow: string;
    title?: string;
    icon: ReactNode;
    children: ReactNode;
};

export function Section({ eyebrow, title = "", icon, children }: SectionProps) {
    return (
        <section className="panel-section">
            <div className="section-heading">
                <span className="section-icon">{icon}</span>
                <div>
                    <span className="eyebrow">{eyebrow}</span>
                    <h2>{title}</h2>
                </div>
            </div>
            {children}
        </section>
    );
}
