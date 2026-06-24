export function rows<T>(result: unknown): T[] {
  return result as T[];
}
