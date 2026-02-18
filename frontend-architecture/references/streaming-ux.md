# Streaming and Progressive UX

When the UI receives content progressively (from streaming APIs, AI agents, or real-time systems), render through stable stages rather than replacing content unpredictably.

## Stage Model

Define explicit rendering stages:

### 1. Draft

Skeleton layout, minimal content. Renders fast while data is still arriving. The container's dimensions are established so surrounding layout is stable.

### 2. Validated

Content has passed the policy layer. Stable titles, labels, and interaction points are rendered.

### 3. Enhanced

Final polish: annotations, secondary details, transitions. Added after core content is stable.

## Canvas Rules

- The content frame appears immediately when streaming begins
- Updates animate inside the content container, never causing surrounding layout to jump or reflow
- The UI remains interactive while streaming is in progress — never block user input while waiting for a stream to complete
