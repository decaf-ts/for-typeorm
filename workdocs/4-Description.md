# Decaf.ts for TypeORM — Detailed Description

Decaf.ts for TypeORM provides a complete implementation of Decaf.ts' data access abstractions backed by a TypeORM DataSource. It bridges Decaf models, repositories, and query primitives with TypeORM's ORM facilities, while keeping a consistent API across different database adapters in the Decaf.ts ecosystem.

Core capabilities include:
- An Adapter (TypeORMAdapter) that encapsulates connection management, CRUD operations, schema creation helpers, index generation, raw execution, error translation, and wiring of decorators.
- A Repository (TypeORMRepository) that exposes typed CRUD and batch operations for a given Model, validating data via @decaf-ts/db-decorators and @decaf-ts/decorator-validation.
- Query composition via TypeORMStatement, which converts the Decaf.ts core Statement API into TypeORM Find options and QueryBuilder calls. Combined with TypeORMPaginator to paginate results.
- Decorator overrides that mirror TypeORM’s decorators (Entity, Column, PrimaryColumn, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, JoinColumn, OneToOne, OneToMany, ManyToOne) ensuring compatible metadata is emitted for the adapter.
- Sequence utilities (TypeORMSequence) for generating and reading database sequence values.
- Index generation helpers (generateIndexes) to produce SQL index creation statements based on model metadata.
- Typed constants, enums, and helper types for SQL operators, query containers, and PostgreSQL result shapes.

Architecture and responsibilities

1. Adapter layer
   - TypeORMAdapter is the central integration point. It:
     - Holds a TypeORM DataSource and provides dataSource(), connect(), createDatabase(), createUser(), and related helpers.
     - Implements CRUD over entities: create, read, update, delete, and their batch counterparts (createAll, readAll, updateAll, deleteAll).
     - Provides Statement(), Sequence(), Repository() factories returning TypeORM-specific implementations.
     - Indexing support via index(models) which uses generateIndexes to build SQL statements for indexes.
     - Raw execution via raw({ query, values }).
     - Error translation through parseError() mapping DB errors to Decaf.ts errors.
     - Schema creation helpers: parseTypeToPostgres, parseValidationToPostgres, parseRelationsToPostgres, createTable.
     - Decoration() static initializer: wires Decaf.ts model decorators and relation metadata to TypeORM’s metadata storage using the overrides in src/overrides.

2. Repository layer
   - TypeORMRepository<M> extends the Decaf.ts core Repository and provides:
     - Validation enforcement (enforceDBDecorators) and Context propagation.
     - Standard CRUD and batch operations that delegate to the adapter, applying OperationKeys flags and TypeORMFlags.
     - Query builder access via queryBuilder() to get a TypeORMStatement for fluent querying.

3. Query layer
   - TypeORMStatement<M, R> extends core Statement and composes queries as TypeORM Find options/QueryBuilder calls.
     - build() resolves the internal statement into a TypeORMQuery container.
     - raw() executes a SelectQueryBuilder and returns getMany() results.
     - paginate(size) returns a TypeORMPaginator bound to this statement.
     - translateOperators() maps Decaf.ts Operator/GroupOperator to SQL via TypeORMOperator/TypeORMGroupOperator.
   - TypeORMPaginator<M, R> implements page navigation using TypeORM’s repository.findAndCount with take/skip and maps rows back to models via the adapter’s revert().

4. Decorator overrides
   - Functions mirroring TypeORM decorators but routed through our overrides/utilities to control metadata aggregation:
     - Entity, Column, PrimaryColumn, PrimaryGeneratedColumn.
     - CreateDateColumn, UpdateDateColumn.
     - JoinColumn.
     - OneToOne, OneToMany, ManyToOne.
   - These register metadata through getMetadataArgsStorage() and the helper aggregateOrNewColumn to avoid duplicates and merge options.

5. Sequences
   - TypeORMSequence implements the Decaf.ts Sequence abstraction using Adapter.raw to query and increment PostgreSQL sequences, parsing values according to the configured type.

6. Index generation
   - generateIndexes(models) inspects Repository.indexes metadata and returns a list of TypeORMQuery statements to create indexes. The Adapter can execute them via raw().

7. Dispatching and events
   - TypeORMDispatch extends core Dispatch to subscribe a TypeORM DataSource to a TypeORMEventSubscriber, translating TypeORM entity events (insert/update/delete) into OperationKeys notifications for Decaf.ts observers.
   - TypeORMEventSubscriber listens to afterInsert/afterUpdate/afterRemove, resolves the model/table via Repository.table, and calls adapter.updateObservers.

8. Constants, types, and utilities
   - constants: reservedAttributes regex, TypeORMFlavour identifier, TypeORMKeys for common DB keys.
   - query/constants: TypeORMQueryLimit and mappings for TypeORMOperator (comparison operators) and TypeORMGroupOperator (logical operators), plus TypeORMConst.
   - types: SQLOperator enum; TypeORMQuery container; TypeORMFlags; TypeORMTableSpec.
   - raw/postgres: FieldDef, QueryResultBase, QueryResult, QueryArrayResult for typing raw Postgres results.
   - utils: convertJsRegexToPostgres() to transform JS RegExp into PostgreSQL POSIX pattern strings.

Typical usage flow

1. Initialize and decorate
   - Import from `@decaf-ts/for-typeorm` index. It calls TypeORMAdapter.decoration() on import to ensure decorators are wired.
2. Configure adapter and data source
   - Construct a TypeORMAdapter with DataSourceOptions, then initialize/connect.
3. Define models with decaf-ts decorators, keeping it consistent decorators:
   - use @table() instead of @Entity();
   - use @column() instead of @Column();
   - always use decaf-ts decorators instead of TypeORM decorators. Decaf's will be wired to TypeORM's metadata storage.
4. Use repositories
   - Use Repository.forModel to get a decaf repository for your model.
   - Get a TypeORMRepository native features use repository.nativeRepository().
5. Build queries
   - Using the decaf query api, all queries are guaranteed to use prepared statements via repository.select()
   - Use repository.queryBuilder() to use native typeorm query builder for edge cases or advanced queries.
6. Sequences and indexes
   - Use TypeORMSequence for sequence values and generateIndexes to pre-create DB indexes.
7. Observe changes
   - Use TypeORMDispatch to subscribe to entity events and update observers in real time.

Error handling

- IndexError signals issues with index generation/handling.
- Adapter.parseError translates TypeORM/DB errors into Decaf.ts error types (ConflictError, NotFoundError, etc.) for consistent error semantics across adapters.

Database and compatibility notes

- The adapter targets TypeORM; many helper utilities assume PostgreSQL (e.g., regex operators, sequence queries). The code converts JS regex to PostgreSQL-compatible patterns and defines raw result typings for Postgres.

Exports overview (primary)

- Classes: TypeORMAdapter, TypeORMRepository, TypeORMDispatch, TypeORMEventSubscriber, TypeORMStatement, TypeORMPaginator, TypeORMSequence, IndexError.
- Decorators and helpers: Entity, Column, PrimaryColumn, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, JoinColumn, OneToOne, OneToMany, ManyToOne, aggregateOrNewColumn.
- Query utilities: TypeORMQueryLimit, TypeORMOperator, TypeORMGroupOperator, TypeORMConst, translateOperators.
- Types: SQLOperator, TypeORMQuery, TypeORMFlags, TypeORMTableSpec.
- Constants: reservedAttributes, TypeORMKeys, TypeORMFlavour.
- Utils: convertJsRegexToPostgres.
- Raw typing: FieldDef, QueryResultBase, QueryResult, QueryArrayResult.
