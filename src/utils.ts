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
