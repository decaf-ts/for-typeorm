/**
 * @description Converts a JavaScript RegExp pattern to a PostgreSQL POSIX pattern string.
 * @summary Accepts either a RegExp object or a string representation (/pattern/flags) and returns the raw pattern compatible with PostgreSQL's ~ and ~* operators.
 * @param {RegExp|string} jsRegex JavaScript RegExp object or pattern string.
 * @return {string} PostgreSQL-compatible regex pattern string.
 * @function convertJsRegexToPostgres
 * @mermaid
 * sequenceDiagram
 *   participant App
 *   participant Utils as convertJsRegexToPostgres
 *   App->>Utils: convertJsRegexToPostgres(RegExp("foo.*","i"))
 *   Utils->>Utils: Parse string or use RegExp.source
 *   Utils-->>App: "foo.*"
 * @memberOf module:for-typeorm
 */
export function convertJsRegexToPostgres(jsRegex: RegExp | string): string {
  const rxp = new RegExp(/^\/(.+)\/(\w+)$/g);
  if (typeof jsRegex === "string") {
    const match = rxp.exec(jsRegex);
    if (match) {
      const [, p] = match;
      jsRegex = p;
    }
  }
  const regex = typeof jsRegex === "string" ? new RegExp(jsRegex) : jsRegex;

  const pattern = regex.source;

  return pattern;
}
