# Semantic Evaluator

En este repositorio está nuestra implementación de una aplicación con una interfaz gráfica para evaluar fórmulas de lenguajes de primer orden con interpretaciones dadas, la cual utiliza un árbol 3D hecho con billboards para representar/editar la fórmula y a la vez mostrar sus valores de verdad dentro de él.

## Integrantes del grupo

Los integrantes del grupo somos:

- Santiago Cordero (Carnet 24472)
- Diego González (Carnet 24170)
- Jorge Morales (Carnet )

Y la sección del curso en la que estamos es la 10.

## Estructura del código

El código está estructurado de la siguiente manera con respecto a la raíz del repositorio:

```bash
.
├── bun.lock
├── dist
│   ├── assets
│   │   ├── favicon-CxcpBtdz.png
│   │   ├── index-D91o8jZz.css
│   │   ├── index-Dc0CeKMr.js
│   │   ├── NotoSansMath-Regular-C1y69Ftz.ttf
│   │   ├── spotify-D5dxRShm.png
│   │   └── SyntaxTreeRenderer-uF_aJ_N5.js
│   └── index.html
├── favicon.png
├── index.html
├── package.json
├── README.md
├── src
│   ├── App.tsx
│   ├── assets
│   │   ├── NotoSansMath-Regular.ttf
│   │   └── spotify.png
│   ├── components
│   │   ├── dialogs
│   │   │   ├── dialogs.css
│   │   │   ├── EvidenceDialog.tsx
│   │   │   ├── HelpDialog.tsx
│   │   │   ├── spotify.css
│   │   │   └── SpotifyDialog.tsx
│   │   ├── evaluation
│   │   │   ├── evaluation.css
│   │   │   ├── node-trace-dialog.css
│   │   │   ├── NodeTraceDialog.tsx
│   │   │   └── TraceNode.tsx
│   │   ├── parameters
│   │   │   ├── ArityStepper.tsx
│   │   │   ├── definition-table.css
│   │   │   ├── DefinitionTable.tsx
│   │   │   ├── drawer-actions.css
│   │   │   ├── formula-section.css
│   │   │   ├── FormulaSection.tsx
│   │   │   ├── interpretation-section.css
│   │   │   ├── InterpretationSection.tsx
│   │   │   ├── LanguageSection.tsx
│   │   │   ├── parameter-drawer.css
│   │   │   ├── ParameterDrawer.tsx
│   │   │   ├── parameter-section.css
│   │   │   └── PredicateTupleEditor.tsx
│   │   ├── ui
│   │   │   ├── Section.tsx
│   │   │   ├── toast.css
│   │   │   └── Toast.tsx
│   │   ├── validation
│   │   │   ├── FormulaHighlight.tsx
│   │   │   ├── validation.css
│   │   │   ├── ValidationDialog.tsx
│   │   │   └── ValidationSummary.tsx
│   │   └── workspace
│   │       ├── InteractionHint.tsx
│   │       ├── ResultButton.tsx
│   │       ├── syntax-tree.css
│   │       ├── SyntaxTree.tsx
│   │       ├── three
│   │       │   └── SyntaxTreeRenderer.ts
│   │       ├── workspace-controls.css
│   │       ├── WorkspaceHeader.tsx
│   │       ├── workspace-shell.css
│   │       └── Workspace.tsx
│   ├── data
│   │   └── demo.ts
│   ├── domain
│   │   ├── evaluation
│   │   │   ├── evaluator.ts
│   │   │   ├── index.ts
│   │   │   ├── model.ts
│   │   │   ├── traceIndex.ts
│   │   │   └── types.ts
│   │   ├── interpretation.ts
│   │   ├── syntaxTree.ts
│   │   └── validation
│   │       ├── format.ts
│   │       ├── index.ts
│   │       ├── lexer.ts
│   │       ├── parser.ts
│   │       ├── rules.ts
│   │       ├── signature.ts
│   │       ├── treeChecks.ts
│   │       ├── types.ts
│   │       └── validator.ts
│   ├── main.tsx
│   ├── styles
│   │   ├── base.css
│   │   ├── responsive.css
│   │   └── shared-controls.css
│   ├── tests
│   │   ├── evaluation.test.ts
│   │   └── validation.test.ts
│   ├── types
│   │   ├── logic.ts
│   │   └── troika-three-text.d.ts
│   ├── utils
│   │   └── cartesianPower.ts
│   └── vite-env.d.ts
├── tsconfig.json
├── tsconfig.node.tsbuildinfo
├── tsconfig.tsbuildinfo
└── vite.config.ts

21 directories, 85 files
```

## Ejecución del código

El código está estructurado con bun como manejador de paquetes, utilizando vite para servir la aplicación HTML y Typescript/React/ThreeJS como dependencias. Para ejecutar la aplicación localmente solo es necesario ejecutar los siguientes comandos y automáticamente se servirá en `http://localhost:3000`:

```bash
bun install
bun run dev
```
También se puede ejecutar la aplicación sin descargar bun al abrir el `index.html` dentro de `./dist/index.html`, el cual contiene el mismo código ya precompilado por vite.
