import { MaybeContextualArg, Paginator, PagingError } from "@decaf-ts/core";
import { TypeORMQuery } from "../types";
import { Model } from "@decaf-ts/decorator-validation";
import { TypeORMAdapter, TypeORMContext } from "../TypeORMAdapter";
import { FindManyOptions, Repository as Repo } from "typeorm";
import { Constructor, Metadata } from "@decaf-ts/decoration";
import { Context, OperationKeys } from "@decaf-ts/db-decorators";

/**
 * @description Paginator for TypeORM query results.
 * @summary Implements pagination for TypeORM-built queries using take/skip for efficient navigation through result sets.
 * @template M The model type that extends Model.
 * @template R The result type.
 * @param {TypeORMAdapter} adapter The TypeORM adapter.
 * @param {TypeORMQuery} query The query container to paginate.
 * @param {number} size The page size.
 * @param {Constructor<M>} clazz The model constructor.
 * @class TypeORMPaginator
 * @example
 * // Example of using TypeORMPaginator
 * const paginator = new TypeORMPaginator(adapter, { query: qb }, 10, User);
 * const page1 = await paginator.page(1);
 * const page2 = await paginator.page(2);
 */
export class TypeORMPaginator<M extends Model, R> extends Paginator<
  M,
  R,
  TypeORMQuery
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

  private __repo?: Repo<any>;

  protected get repo() {
    if (!this.__repo) {
      this.__repo = (this.adapter as TypeORMAdapter).client.getRepository(
        Metadata.constr(this.clazz)
      );
    }
    return this.__repo;
  }

  /**
   * @description Creates a new TypeORMPaginator instance.
   * @summary Initializes a paginator for TypeORM query results.
   * @param {TypeORMAdapter} adapter The TypeORM adapter.
   * @param {TypeORMQuery} query The TypeORM query container to paginate.
   * @param {number} size The page size.
   * @param {Constructor<M>} clazz The model constructor.
   */
  constructor(
    adapter: TypeORMAdapter,
    query: TypeORMQuery,
    size: number,
    clazz: Constructor<M>
  ) {
    super(adapter, query, size, clazz);
  }

  /**
   * @description Prepares a query for pagination
   * @summary Modifies the raw query to include pagination parameters
   * @param {TypeORMQuery} rawStatement - The original PostgreSQL query
   * @return {TypeORMQuery} The prepared query with pagination parameters
   */
  protected prepare(rawStatement: TypeORMQuery): TypeORMQuery {
    const query: TypeORMQuery = { ...rawStatement };
    return query;
  }

  /**
   * @description Retrieves a specific page of results.
   * @summary Executes the query with pagination and processes the results.
   * @param {number} [page=1] The page number to retrieve.
   * @return {Promise<R[]>} A promise that resolves to an array of results.
   * @throws {PagingError} If trying to access an invalid page or if no class is defined.
   * @mermaid
   * sequenceDiagram
   *   participant Client
   *   participant Paginator as TypeORMPaginator
   *   participant Adapter
   *   participant DB as Database
   *
   *   Client->>Paginator: page(pageNumber)
   *   Note over Paginator: Prepare options (skip/take)
   *
   *   alt First time or need count
   *     Paginator->>Adapter: Get count
   *     Adapter->>DB: Execute COUNT
   *     DB-->>Adapter: count
   *     Adapter-->>Paginator: count
   *     Paginator->>Paginator: Calculate total pages
   *   end
   *
   *   Paginator->>Adapter: Execute query
   *   Adapter->>DB: findAndCount(options)
   *   DB-->>Adapter: rows, count
   *   Adapter-->>Paginator: rows, count
   *
   *   Paginator->>Paginator: Map rows to models
   *   Paginator-->>Client: results
   */

  async page(
    page: number = 1,
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<R[]> {
    const contextArgs = await Context.args<M, TypeORMContext>(
      OperationKeys.READ,
      this.clazz,
      args,
      this.adapter,
      {}
    );
    const ctx = contextArgs.context;
    const statement = { ...this.statement };

    // Get total count if not already calculated
    if (!this._recordCount || !this._totalPages) {
      this._totalPages = this._recordCount = 0;
    }

    const opts: FindManyOptions<M> = Object.assign(statement, {
      skip: (this.current || 0) * this.size,
      take: this.size,
    });

    // this.validatePage(page);

    const result = await this.repo.findAndCount(opts);

    this._recordCount = result[1];
    this._totalPages = Math.ceil(this._recordCount / this.size);

    if (!this.clazz) throw new PagingError("No statement target defined");

    const pkDef = Model.pk(this.clazz) as string;
    const rows = result[0] || [];

    const results =
      // statement.columns && statement.columns.length
      //   ? rows // has columns means it's not full model
      rows.map((row: any) => {
        return this.adapter.revert(row, this.clazz, row[pkDef], undefined, ctx);
      });

    this._currentPage = page;
    return results as unknown as R[];
  }
}
