import { Model } from "@decaf-ts/decorator-validation";
import { Repository } from "@decaf-ts/core";
import { Context, RepositoryFlags } from "@decaf-ts/db-decorators";
import { PostgresAdapter } from "./adapter";
import { PostgresQuery } from "./types";

/**
 * @description Type for PostgreSQL database repositories
 * @summary A specialized repository type for working with PostgreSQL databases, extending the base Repository
 * with PostgreSQL-specific adapter, flags, and context types
 * @template M - Type extending Model that this repository will manage
 * @memberOf module:for-postgres
 */
export type PostgresRepository<M extends Model> = Repository<
  M,
  PostgresQuery,
  PostgresAdapter,
  RepositoryFlags,
  Context<RepositoryFlags>
>;
