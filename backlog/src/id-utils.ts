/**
 * Qualified ID utilities.
 *
 * On disk, items use local IDs like `B-001`. At the API layer, multi-project
 * mode uses qualified IDs like `frontend/B-001`. These helpers convert between
 * the two forms.
 */

export interface QualifiedId {
  project?: string;
  localId: string;
}

/**
 * Parse a potentially project-qualified ID.
 *
 * Examples:
 *   "B-001"           → { localId: "B-001" }
 *   "frontend/B-001"  → { project: "frontend", localId: "B-001" }
 *   "api/B-040.2"     → { project: "api", localId: "B-040.2" }
 */
export function parseQualifiedId(id: string): QualifiedId {
  const slash = id.indexOf("/");
  if (slash < 0) return { localId: id };
  const project = id.substring(0, slash);
  const localId = id.substring(slash + 1);
  if (!project || !localId) throw new Error(`Invalid qualified id: ${id}`);
  return { project, localId };
}

/**
 * Build a qualified ID string from parts.
 */
export function toQualifiedId(project: string | undefined, localId: string): string {
  return project ? `${project}/${localId}` : localId;
}

/**
 * Validate that a local ID matches the expected format.
 */
export function isValidLocalId(id: string): boolean {
  return /^[A-Z]+-\d+(?:\.\d+)*$/.test(id);
}

/**
 * Validate a project name (alphanumeric, hyphens, underscores).
 */
export function isValidProjectName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name);
}
