/**
 * Safely parse a fetch Response as JSON.
 * Handles non-JSON error bodies (plain text, HTML) gracefully instead of
 * throwing "Unexpected token ... is not valid JSON".
 */
export async function parseJsonOrThrow<T = Record<string, unknown>>(resp: Response): Promise<T> {
  const text = await resp.text();
  try {
    const data = text ? JSON.parse(text) : {};
    if (!resp.ok) {
      throw new Error(
        (data as { error?: string }).error || text || `Request failed (${resp.status})`
      );
    }
    return data as T;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        resp.ok
          ? 'Invalid response from server'
          : text.slice(0, 200) || `Request failed (${resp.status})`
      );
    }
    throw err;
  }
}
