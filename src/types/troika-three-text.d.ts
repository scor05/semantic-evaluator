declare module "troika-three-text" {
    import { Mesh, type ColorRepresentation } from "three";

    export class Text extends Mesh {
        text: string;
        font: string | null;
        fontSize: number;
        color: ColorRepresentation;
        anchorX: "left" | "center" | "right" | number;
        anchorY: "top" | "top-baseline" | "middle" | "bottom-baseline" | "bottom" | number;
        outlineWidth: string | number;
        outlineColor: ColorRepresentation;
        depthOffset: number;
        sync(callback?: () => void): void;
        dispose(): void;
    }
}
