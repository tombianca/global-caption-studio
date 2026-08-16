// Pure, framework-free authorization primitives (unit-tested without Next).

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Ownership assertion. Throws ApiError unless the project exists AND belongs
 * to `userId`.
 */
export function assertOwned(
  project: { userId: string } | null | undefined,
  userId: string,
): asserts project is { userId: string } {
  if (!project) throw new ApiError(404, 'Project not found.', 'NOT_FOUND');
  if (project.userId !== userId) throw new ApiError(403, 'You do not have access to this project.', 'FORBIDDEN');
}
