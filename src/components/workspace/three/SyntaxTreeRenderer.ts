import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Text } from "troika-three-text";
import mathFontUrl from "../../../assets/NotoSansMath-Regular.ttf?url";
import type { SyntaxNode, SyntaxNodeKind } from "../../../domain/syntaxTree";

export type TreeEditAction = "wrap" | "add-child" | "remove";

type RendererCallbacks = {
    onSelectNode: (nodeId: string | null) => void;
    onEditNode: (action: TreeEditAction, nodeId: string) => void;
};

type NodePosition = {
    node: SyntaxNode;
    position: THREE.Vector3;
};

const nodeColors: Record<SyntaxNodeKind, number> = {
    quantifier: 0x8af0ca,
    connective: 0xe2ebe8,
    predicate: 0x79e3bc,
    function: 0xb9d9cf,
    value: 0xf0c674,
    term: 0xf0f7f5,
};

export class SyntaxTreeRenderer {
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    private readonly renderer: THREE.WebGLRenderer;
    private readonly controls: OrbitControls;
    private readonly dynamicRoot = new THREE.Group();
    private readonly raycaster = new THREE.Raycaster();
    private readonly pointer = new THREE.Vector2();
    private readonly interactiveMeshes: THREE.Object3D[] = [];
    private readonly billboardTargets: THREE.Object3D[] = [];
    private readonly labels: Text[] = [];
    private readonly movementKeys = new Set<string>();
    private readonly animationClock = new THREE.Clock();
    private readonly resizeObserver: ResizeObserver;
    private readonly callbacks: RendererCallbacks;
    private readonly container: HTMLElement;
    private pointerStart = new THREE.Vector2();
    private tree: SyntaxNode | null = null;
    private selectedNodeId: string | null = null;
    private editMode = false;
    private disposed = false;
    private hasFramedTree = false;

    constructor(container: HTMLElement, callbacks: RendererCallbacks) {
        this.container = container;
        this.callbacks = callbacks;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.domElement.className = "syntax-tree-canvas";
        container.appendChild(this.renderer.domElement);

        this.camera.position.set(0, 1.5, 13);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.075;
        this.controls.enablePan = true;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 30;
        this.controls.target.set(0, 0, 0);

        this.scene.add(this.dynamicRoot);
        this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
        this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("keyup", this.handleKeyUp);
        window.addEventListener("blur", this.clearMovementKeys);
        this.resizeObserver = new ResizeObserver(this.resize);
        this.resizeObserver.observe(container);
        this.resize();
        this.renderer.setAnimationLoop(this.render);
    }

    setTree(tree: SyntaxNode): void {
        this.tree = tree;
        this.rebuildScene();
    }

    clearTree(): void {
        this.tree = null;
        this.selectedNodeId = null;
        this.clearDynamicScene();
    }

    setInteraction(editMode: boolean, selectedNodeId: string | null): void {
        const changed = this.editMode !== editMode || this.selectedNodeId !== selectedNodeId;
        this.editMode = editMode;
        this.selectedNodeId = selectedNodeId;
        this.controls.enabled = !editMode;
        this.renderer.domElement.classList.toggle("is-editing", editMode);
        if (changed && this.tree) this.rebuildScene();
    }

    dispose(): void {
        this.disposed = true;
        this.renderer.setAnimationLoop(null);
        this.resizeObserver.disconnect();
        this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
        this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("keyup", this.handleKeyUp);
        window.removeEventListener("blur", this.clearMovementKeys);
        this.controls.dispose();
        this.clearDynamicScene();
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }

    private rebuildScene(): void {
        if (!this.tree) return;
        this.clearDynamicScene();

        const positions = this.layoutTree(this.tree);
        for (const { node, position } of positions.values()) {
            this.addNode(node, position);
            for (const child of node.children) {
                const childEntry = positions.get(child.id);
                if (childEntry) this.addEdge(node, position, childEntry.node, childEntry.position);
            }
        }

        if (this.editMode && this.selectedNodeId) {
            const selected = positions.get(this.selectedNodeId);
            if (selected) this.addEditHandles(selected.position, selected.node.id);
        }

        if (!this.hasFramedTree) {
            this.frameTree(positions);
            this.hasFramedTree = true;
        }
    }

    private layoutTree(root: SyntaxNode): Map<string, NodePosition> {
        const positions = new Map<string, NodePosition>();
        let leafCursor = 0;

        const visit = (node: SyntaxNode, depth: number, zOffset: number): THREE.Vector3 => {
            const childPositions = node.children.map((child, index) => {
                const centeredIndex = index - (node.children.length - 1) / 2;
                return visit(child, depth + 1, zOffset + centeredIndex * 0.72);
            });

            const x = childPositions.length > 0
                ? childPositions.reduce((total, position) => total + position.x, 0) / childPositions.length
                : leafCursor++ * 2.35;
            const position = new THREE.Vector3(x, -depth * 2.15, zOffset);
            positions.set(node.id, { node, position });
            return position;
        };

        const rootPosition = visit(root, 0, 0);
        for (const entry of positions.values()) {
            entry.position.x -= rootPosition.x;
            entry.position.y += 3.1;
        }
        return positions;
    }

    private addNode(node: SyntaxNode, position: THREE.Vector3): void {
        const selected = node.id === this.selectedNodeId;
        const text = this.createText(node.label, 0.72, nodeColors[node.kind]);
        text.position.copy(position);
        text.outlineWidth = selected ? "9%" : "3%";
        text.outlineColor = selected ? 0x2a9c78 : 0x07100d;
        text.renderOrder = 10;
        this.dynamicRoot.add(text);
        this.labels.push(text);

        // Keep a generous invisible target behind the glyphs so short symbols
        // remain easy to select without drawing a box around them.
        const hitWidth = Math.max(1.05, 0.5 + [...node.label].length * 0.52);
        const hitTarget = new THREE.Mesh(
            new THREE.PlaneGeometry(hitWidth, 0.95),
            new THREE.MeshBasicMaterial({
                colorWrite: false,
                depthWrite: false,
                opacity: 0,
                side: THREE.DoubleSide,
                transparent: true,
            }),
        );
        hitTarget.position.copy(position);
        hitTarget.userData = { interaction: "node", nodeId: node.id };
        this.dynamicRoot.add(hitTarget);
        this.interactiveMeshes.push(hitTarget);
        this.billboardTargets.push(hitTarget);
    }

    private addEdge(
        parentNode: SyntaxNode,
        parentPosition: THREE.Vector3,
        childNode: SyntaxNode,
        childPosition: THREE.Vector3,
    ): void {
        const direction = new THREE.Vector3().subVectors(childPosition, parentPosition);
        const unitDirection = direction.clone().normalize();
        const start = parentPosition.clone().addScaledVector(unitDirection, this.nodeClearance(parentNode));
        const end = childPosition.clone().addScaledVector(unitDirection, -this.nodeClearance(childNode));
        const clippedDirection = new THREE.Vector3().subVectors(end, start);
        const length = Math.max(0.05, clippedDirection.length());
        const geometry = new THREE.CylinderGeometry(0.035, 0.035, length, 10);
        const material = new THREE.MeshBasicMaterial({
            color: 0x79e3bc,
            transparent: true,
            opacity: 0.5,
        });
        const edge = new THREE.Mesh(geometry, material);
        edge.position.copy(start).add(end).multiplyScalar(0.5);
        edge.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            clippedDirection.normalize(),
        );
        this.dynamicRoot.add(edge);
    }

    private nodeClearance(node: SyntaxNode): number {
        return Math.max(0.64, 0.35 + [...node.label].length * 0.22);
    }

    private addEditHandles(position: THREE.Vector3, nodeId: string): void {
        this.addHandle(position.clone().add(new THREE.Vector3(0, 1.05, 0)), nodeId, "wrap", "+", false);
        this.addHandle(position.clone().add(new THREE.Vector3(0, -1.05, 0)), nodeId, "add-child", "+", false);
        this.addHandle(position.clone().add(new THREE.Vector3(1.05, 0, 0)), nodeId, "remove", "−", true);
    }

    private addHandle(
        position: THREE.Vector3,
        nodeId: string,
        action: TreeEditAction,
        label: string,
        danger: boolean,
    ): void {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.24, 20, 14),
            new THREE.MeshBasicMaterial({ color: danger ? 0xff7b78 : 0x79e3bc }),
        );
        mesh.position.copy(position);
        mesh.userData = { interaction: "handle", nodeId, action };
        this.dynamicRoot.add(mesh);
        this.interactiveMeshes.push(mesh);

        const text = this.createText(label, 0.34, danger ? 0x2d0908 : 0x082016, true);
        text.position.copy(position);
        text.renderOrder = 12;
        this.dynamicRoot.add(text);
        this.labels.push(text);
    }

    private createText(value: string, size: number, color: number, alwaysOnTop = false): Text {
        const text = new Text();
        text.text = value;
        text.font = mathFontUrl;
        text.fontSize = size;
        text.color = color;
        text.anchorX = "center";
        text.anchorY = "middle";
        text.outlineWidth = "2%";
        text.outlineColor = 0x07100d;
        text.depthOffset = -2;
        if (alwaysOnTop) {
            const materials = Array.isArray(text.material) ? text.material : [text.material];
            for (const material of materials) {
                material.depthTest = false;
                material.depthWrite = false;
            }
        }
        text.sync();
        return text;
    }

    private frameTree(positions: Map<string, NodePosition>): void {
        const points = [...positions.values()].map(({ position }) => position);
        if (points.length === 0) return;
        const box = new THREE.Box3().setFromPoints(points);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const distance = Math.max(9, Math.max(size.x, size.y) * 1.18 + 5);
        this.controls.target.copy(center);
        this.camera.position.set(center.x + 0.6, center.y + 0.8, center.z + distance);
        this.controls.update();
    }

    private clearDynamicScene(): void {
        for (const label of this.labels) label.dispose();
        this.labels.length = 0;
        this.interactiveMeshes.length = 0;
        this.billboardTargets.length = 0;
        this.dynamicRoot.traverse((object) => {
            if (!(object instanceof THREE.Mesh) || object instanceof Text) return;
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) material.dispose();
        });
        this.dynamicRoot.clear();
    }

    private handlePointerDown = (event: PointerEvent): void => {
        this.pointerStart.set(event.clientX, event.clientY);
    };

    private handlePointerUp = (event: PointerEvent): void => {
        if (!this.editMode) return;
        const movement = this.pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
        if (movement > 5) return;

        const bounds = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set(
            ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
            -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
        );
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hit = this.raycaster.intersectObjects(this.interactiveMeshes, false)[0]?.object;
        if (!hit) {
            this.callbacks.onSelectNode(null);
            return;
        }

        const { interaction, nodeId, action } = hit.userData as {
            interaction: "node" | "handle";
            nodeId: string;
            action?: TreeEditAction;
        };
        if (interaction === "handle" && action) {
            this.callbacks.onEditNode(action, nodeId);
        } else {
            this.callbacks.onSelectNode(nodeId);
        }
    };

    private handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Shift") {
            this.movementKeys.add(event.key);
            return;
        }
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        const activeElement = document.activeElement;
        if (
            activeElement instanceof HTMLInputElement
            || activeElement instanceof HTMLTextAreaElement
            || activeElement instanceof HTMLSelectElement
            || (activeElement instanceof HTMLElement && activeElement.isContentEditable)
        ) return;

        event.preventDefault();
        this.movementKeys.add(event.key);
    };

    private handleKeyUp = (event: KeyboardEvent): void => {
        this.movementKeys.delete(event.key);
    };

    private clearMovementKeys = (): void => {
        this.movementKeys.clear();
    };

    private updateContinuousMovement(deltaSeconds: number): void {
        const verticalDirection = Number(this.movementKeys.has("ArrowUp"))
            - Number(this.movementKeys.has("ArrowDown"));
        if (verticalDirection === 0) return;

        const speed = this.movementKeys.has("Shift") ? 6.4 : 3.2;
        const movement = verticalDirection * speed * deltaSeconds;
        this.camera.position.y += movement;
        this.controls.target.y += movement;
    }

    private resize = (): void => {
        const width = Math.max(1, this.container.clientWidth);
        const height = Math.max(1, this.container.clientHeight);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    };

    private render = (): void => {
        if (this.disposed) return;
        this.updateContinuousMovement(Math.min(this.animationClock.getDelta(), 0.05));
        this.controls.update();
        for (const label of this.labels) label.quaternion.copy(this.camera.quaternion);
        for (const target of this.billboardTargets) target.quaternion.copy(this.camera.quaternion);
        this.renderer.render(this.scene, this.camera);
    };
}
