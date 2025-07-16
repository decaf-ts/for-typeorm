import { Paginator } from "@decaf-ts/core";
import { PostgresQuery } from "../types";
import { Constructor, Model } from "@decaf-ts/decorator-validation";
import { PostgresAdapter } from "../adapter";

/**
 * @description Paginator for PostgreSQL query results
 * @summary Implements pagination for PostgreSQL queries using LIMIT and OFFSET for efficient navigation through result sets
 * @template M - The model type that extends Model
 * @template R - The result type
 * @param {PostgresAdapter<any, any, any>} adapter - The PostgreSQL adapter
 * @param {PostgresQuery} query - The PostgresSQL query to paginate
 * @param {number} size - The page size
 * @param {Constructor<M>} clazz - The model constructor
 * @class PostgresPaginator
 * @example
 * // Example of using PostgreSQLPaginator
 * const adapter = new MyPostgreSQLAdapter(pool);
 * const query = { table: "users" };
 * const paginator = new PostgreSQLPaginator(adapter, query, 10, User);
 *
 * // Get the first page
 * const page1 = await paginator.page(1);
 *
 * // Get the next page
 * const page2 = await paginator.page(2);
 */
export class PostgresPaginator<M extends Model, R> extends Paginator<
  M,
  R,
  PostgresQuery
> {
  /**
   * @description Gets the total number of pages
   * @summary Returns the total number of pages based on the record count and page size
   * @return {number} The total number of pages
   */
  override get total(): number {
    return this._totalPages;
  }

  /**
   * @description Gets the total record count
   * @summary Returns the total number of records matching the query
   * @return {number} The total record count
   */
  override get count(): number {
    return this._recordCount;
  }

  /**
   * @description Creates a new PostgreSQLPaginator instance
   * @summary Initializes a paginator for PostgreSQL query results
   * @param {PostgresAdapter} adapter - The PostgreSQL adapter
   * @param {PostgreSQLQuery} query - The PostgreSQL query to paginate
   * @param {number} size - The page size
   * @param {Constructor<M>} clazz - The model constructor
   */
  constructor(
    adapter: PostgresAdapter,
    query: PostgresQuery,
    size: number,
    clazz: Constructor<M>
  ) {
    super(adapter, query, size, clazz);
  }

  /**
   * @description Prepares a query for pagination
   * @summary Modifies the raw query to include pagination parameters
   * @param {PostgresQuery} rawStatement - The original PostgreSQL query
   * @return {PostgresQuery} The prepared query with pagination parameters
   */
  protected prepare(rawStatement: PostgresQuery): PostgresQuery {
    const query: PostgresQuery = { ...rawStatement };
    return query;
  }

  /**
   * @description Retrieves a specific page of results
   * @summary Executes the query with pagination and processes the results
   * @param {number} [page=1] - The page number to retrieve
   * @return {Promise<R[]>} A promise that resolves to an array of results
   * @throws {PagingError} If trying to access an invalid page or if no class is defined
   * @mermaid
   * sequenceDiagram
   *   participant Client
   *   participant PostgreSQLPaginator
   *   participant Adapter
   *   participant PostgreSQL
   *
   *   Client->>PostgreSQLPaginator: page(pageNumber)
   *   Note over PostgreSQLPaginator: Clone statement
   *
   *   alt First time or need count
   *     PostgreSQLPaginator->>Adapter: Get total count
   *     Adapter->>PostgreSQL: Execute COUNT query
   *     PostgreSQL-->>Adapter: Return count
   *     Adapter-->>PostgreSQLPaginator: Return count
   *     PostgreSQLPaginator->>PostgreSQLPaginator: Calculate total pages
   *   end
   *
   *   PostgreSQLPaginator->>PostgreSQLPaginator: validatePage(page)
   *   PostgreSQLPaginator->>PostgreSQLPaginator: Calculate offset
   *   PostgreSQLPaginator->>PostgreSQLPaginator: Add limit and offset to query
   *
   *   PostgreSQLPaginator->>Adapter: raw(statement, false)
   *   Adapter->>PostgreSQL: Execute query
   *   PostgreSQL-->>Adapter: Return results
   *   Adapter-->>PostgreSQLPaginator: Return PostgreSQLResponse
   *
   *   Note over PostgreSQLPaginator: Process results
   *
   *   PostgreSQLPaginator->>PostgreSQLPaginator: Check for clazz
   *
   *   alt No clazz
   *     PostgreSQLPaginator-->>Client: Throw PagingError
   *   else Has clazz
   *     PostgreSQLPaginator->>PostgreSQLPaginator: Find primary key
   *
   *     alt Has columns in statement
   *       PostgreSQLPaginator->>PostgreSQLPaginator: Use rows directly
   *     else No columns
   *       PostgreSQLPaginator->>PostgreSQLPaginator: Process each row
   *       loop For each row
   *         PostgreSQLPaginator->>Adapter: revert(row, clazz, pkDef.id, id)
   *       end
   *     end
   *
   *     PostgreSQLPaginator->>PostgreSQLPaginator: Update currentPage
   *     PostgreSQLPaginator-->>Client: Return results
   *   end
   */
  async page(page: number = 1): Promise<R[]> {
    throw new Error(`Not implemented yet`);
    // const statement = { ...this.statement };
    //
    // // Get total count if not already calculated
    // if (!this._recordCount || !this._totalPages) {
    //   this._totalPages = this._recordCount = 0;
    //
    //   // Create a count query based on the original query
    //   const countQuery: PostgresQuery = {
    //     ...statement,
    //     count: true,
    //     limit: undefined,
    //     offset: undefined,
    //   };
    //
    //   const countResult: QueryResult = await this.adapter.raw(
    //     countQuery,
    //     false
    //   );
    //   this._recordCount = parseInt(countResult.rows[0]?.count || "0", 10);
    //
    //   if (this._recordCount > 0) {
    //     const size = statement?.limit || this.size;
    //     this._totalPages = Math.ceil(this._recordCount / size);
    //   }
    // }
    //
    // this.validatePage(page);
    //
    // // Calculate offset based on page number
    // const offset = (page - 1) * this.size;
    // statement.limit = this.size;
    // statement.offset = offset;
    //
    // const result: PostgreSQLResponse<any> = await this.adapter.raw(
    //   statement,
    //   false
    // );
    //
    // if (!this.clazz) throw new PagingError("No statement target defined");
    //
    // const pkDef = findPrimaryKey(new this.clazz());
    // const rows = result.rows || [];
    //
    // const results =
    //   statement.columns && statement.columns.length
    //     ? rows // has columns means it's not full model
    //     : rows.map((row: any) => {
    //         return this.adapter.revert(
    //           row,
    //           this.clazz,
    //           pkDef.id,
    //           Sequence.parseValue(pkDef.props.type, row[PostgreSQLKeys.ID])
    //         );
    //       });
    //
    // this._currentPage = page;
    // return results as R[];
  }
}
