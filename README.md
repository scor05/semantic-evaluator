# Semantic Evaluator

Interfaz del evaluador semántico para fórmulas de lógica de primer orden.

## Desarrollo

```bash
bun install
bun run dev
```

La aplicación se sirve con Vite. Para comprobar tipos y generar una compilación de
producción:

```bash
bun run typecheck
bun run build
```

## Estado actual

La interfaz incluye la configuración del lenguaje, interpretación, fórmula y entorno,
además de una maqueta interactiva del árbol y sus evidencias. El parser, la evaluación
semántica y el renderizado 3D todavía no están conectados.
