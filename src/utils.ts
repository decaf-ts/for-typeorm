/**
 * Converts a JavaScript RegExp pattern to a PostgreSQL POSIX pattern
 * @param jsRegex JavaScript RegExp object or pattern string
 * @returns PostgreSQL compatible regex pattern string
 */
export function convertJsRegexToPostgres(jsRegex: RegExp | string): string {
  const rxp = new RegExp(/^\/(.+)\/(\w+)$/g);
  if (typeof jsRegex === "string") {
    const match = rxp.exec(jsRegex);
    if (match) {
      const [, p, flags] = match;
      jsRegex = p;
    }
  }
  const regex = typeof jsRegex === "string" ? new RegExp(jsRegex) : jsRegex;

  const pattern = regex.source;

  return pattern;
}
