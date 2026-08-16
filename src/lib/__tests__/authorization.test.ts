import { describe, it, expect } from 'vitest';
import { assertOwned, ApiError } from '../authorization';

describe('user authorization', () => {
  it('allows the owner to access their own project', () => {
    expect(() => assertOwned({ userId: 'user-1' }, 'user-1')).not.toThrow();
  });

  it('denies access to another user\'s project', () => {
    try {
      assertOwned({ userId: 'user-2' }, 'user-1');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).code).toBe('FORBIDDEN');
    }
  });

  it('denies access when the project does not exist', () => {
    try {
      assertOwned(null, 'user-1');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(404);
      expect((err as ApiError).code).toBe('NOT_FOUND');
    }
  });
});
