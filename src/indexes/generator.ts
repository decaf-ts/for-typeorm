import {
  IndexMetadata,
  OrderDirection,
  PersistenceKeys,
  Repository,
} from "@decaf-ts/core";
import { TypeORMKeys } from "../constants";
import { DefaultSeparator } from "@decaf-ts/db-decorators";
import { Constructor } from "@decaf-ts/decoration";
import { Model } from "@decaf-ts/decorator-validation";
import { TypeORMQuery } from "../types";

/**
 * @description Generates a name for a CouchDB index
 * @summary Creates a standardized name for a CouchDB index by combining name parts, compositions, and direction
 * @param {string[]} name - Array of name parts for the index
 * @param {OrderDirection} [direction] - Optional sort direction for the index
 * @param {string[]} [compositions] - Optional additional attributes to include in the index name
 * @param {string} [separator=DefaultSeparator] - The separator to use between parts of the index name
 * @return {string} The generated index name
 * @memberOf module:for-couchdb
 */
function generateIndexName(
  name: string[],
  direction?: OrderDirection,
  compositions?: string[],
  separator = DefaultSeparator
) {
  return [
    ...name.map((n) => (n === TypeORMKeys.TABLE ? "table" : n)),
    ...(compositions || []),
    ...(direction ? [direction] : []),
    TypeORMKeys.INDEX,
  ].join(separator);
}

/**
 * @description Generates CouchDB index configurations for models
 * @summary Creates a set of CouchDB index configurations based on the metadata of the provided models
 * @template M - The model type that extends Model
 * @param models - Array of model constructors to generate indexes for
 * @return {TypeORMQuery} Array of CouchDB index configurations
 * @function generateIndexes
 * @memberOf module:for-couchdb
 * @mermaid
 * sequenceDiagram
 *   participant Caller
 *   participant generateIndexes
 *   participant generateIndexName
 *   participant Repository
 *
 *   Caller->>generateIndexes: models
 *
 *   Note over generateIndexes: Create base table index
 *   generateIndexes->>generateIndexName: [CouchDBKeys.TABLE]
 *   generateIndexName-->>generateIndexes: tableName
 *   generateIndexes->>generateIndexes: Create table index config
 *
 *   loop For each model
 *     generateIndexes->>Repository: Get indexes metadata
 *     Repository-->>generateIndexes: index metadata
 *
 *     loop For each index in metadata
 *       Note over generateIndexes: Extract index properties
 *       generateIndexes->>Repository: Get table name
 *       Repository-->>generateIndexes: tableName
 *
 *       Note over generateIndexes: Define nested generate function
 *
 *       generateIndexes->>generateIndexes: Call generate() for default order
 *       Note over generateIndexes: Create index name and config
 *
 *       alt Has directions
 *         loop For each direction
 *           generateIndexes->>generateIndexes: Call generate(direction)
 *           Note over generateIndexes: Create ordered index config
 *         end
 *       end
 *     end
 *   end
 *
 *   generateIndexes-->>Caller: Array of index configurations
 */
export function generateIndexes<M extends Model>(
  models: Constructor<M>[]
): TypeORMQuery[] {
  const tableName = generateIndexName([TypeORMKeys.TABLE]);
  const indexes: Record<string, TypeORMQuery> = {};
  indexes[tableName] = {
    query: ``,
    values: [],
  };

  models.forEach((m) => {
    const ind: Record<string, IndexMetadata> = Repository.indexes(m);
    Object.entries(ind).forEach(([key, value]) => {
      const k = Object.keys(value)[0];

      let { compositions } = (value as any)[k];
      const tableName = Repository.table(m);
      compositions = compositions || [];

      function generate() {
        const name = [key, ...(compositions as []), PersistenceKeys.INDEX].join(
          DefaultSeparator
        );

        indexes[name] = {
          query: `CREATE INDEX $1 ON $2 ($3);`,
          values: [name, tableName, key],
        };
      }

      generate();
    });
  });
  return Object.values(indexes);
}
