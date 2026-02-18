# Third-Party Library Wrapping

Any third-party rendering library (charts, maps, rich text editors, 3D viewers, etc.) must be wrapped behind a project-owned abstraction.

## The Wrapping Pattern

Three parts:

### 1. Declarative Spec

A project-owned type that describes *what* to render (data references, visual encodings, configuration) without coupling to the library's API.

### 2. Compilation Layer

A function or module that transforms the spec into the library's native configuration format (e.g., chart options, map config, editor state).

### 3. Rendering Component

A project-owned component that accepts the spec, runs it through compilation, and renders via the wrapped library.

## Rules

- Features author specs, never library-native configuration objects
- External inputs (API responses, AI output) produce specs, never library-native objects
- The compilation layer is the **only** code that imports the third-party library's API
- The rendering component is the **only** place that mounts the library's DOM element

This ensures the third-party library can be replaced by changing the compilation and rendering layers without touching any feature code or spec definitions.
