import { OrderDirection, PersistenceKeys } from "@decaf-ts/core";
import { DefaultSeparator } from "@decaf-ts/db-decorators";

/**
 * @description Generates a name for a CouchDB index
 * @summary Creates a standardized name for a CouchDB index based on the table, attribute, compositions, and order
 * @param {string} attribute - The primary attribute for the index
 * @param {string} tableName - The name of the table
 * @param {string[]} [compositions] - Optional additional attributes to include in the index
 * @param {OrderDirection} [order] - Optional sort order for the index
 * @param {string} [separator=DefaultSeparator] - The separator to use between parts of the index name
 * @return {string} The generated index name
 * @function generateIndexName
 * @memberOf module:for-couchdb
 */
export function generateIndexName(
  attribute: string,
  tableName: string,
  compositions?: string[],
  order?: OrderDirection,
  separator = DefaultSeparator
): string {
  const attr = [PersistenceKeys.INDEX, tableName, attribute];
  if (compositions) attr.push(...compositions);
  if (order) attr.push(order);
  return attr.join(separator);
}

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

  // Add start/end anchors if not present and not in multiline mode
  // const needsAnchors =
  //   !regex.multiline && !(pattern.startsWith("^") && pattern.endsWith("$"));
  //
  // if (needsAnchors) {
  //   pattern = `^${pattern}$`;
  // }

  return pattern;
}
