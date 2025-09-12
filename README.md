# Decaf.ts for TypeORM

The for-typeorm package integrates Decaf.ts data-access abstractions with TypeORM. It provides a TypeORM-backed Adapter and Repository, a fluent Statement builder and Paginator, model decorators aligned with TypeORM (Entity/Column/Relations/Date columns/Primary keys), sequence utilities, index generation helpers, typed SQL operators and query containers, plus small utilities for regex and raw Postgres typings. This lets you use Decaf.ts models and repositories seamlessly on top of a TypeORM DataSource.


![Licence](https://img.shields.io/github/license/decaf-ts/ts-workspace.svg?style=plastic)
![GitHub language count](https://img.shields.io/github/languages/count/decaf-ts/ts-workspace?style=plastic)
![GitHub top language](https://img.shields.io/github/languages/top/decaf-ts/ts-workspace?style=plastic)

[![Build & Test](https://github.com/decaf-ts/ts-workspace/actions/workflows/nodejs-build-prod.yaml/badge.svg)](https://github.com/decaf-ts/ts-workspace/actions/workflows/nodejs-build-prod.yaml)
[![CodeQL](https://github.com/decaf-ts/ts-workspace/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/decaf-ts/ts-workspace/actions/workflows/codeql-analysis.yml)[![Snyk Analysis](https://github.com/decaf-ts/ts-workspace/actions/workflows/snyk-analysis.yaml/badge.svg)](https://github.com/decaf-ts/ts-workspace/actions/workflows/snyk-analysis.yaml)
[![Pages builder](https://github.com/decaf-ts/ts-workspace/actions/workflows/pages.yaml/badge.svg)](https://github.com/decaf-ts/ts-workspace/actions/workflows/pages.yaml)
[![.github/workflows/release-on-tag.yaml](https://github.com/decaf-ts/ts-workspace/actions/workflows/release-on-tag.yaml/badge.svg?event=release)](https://github.com/decaf-ts/ts-workspace/actions/workflows/release-on-tag.yaml)

![Open Issues](https://img.shields.io/github/issues/decaf-ts/ts-workspace.svg)
![Closed Issues](https://img.shields.io/github/issues-closed/decaf-ts/ts-workspace.svg)
![Pull Requests](https://img.shields.io/github/issues-pr-closed/decaf-ts/ts-workspace.svg)
![Maintained](https://img.shields.io/badge/Maintained%3F-yes-green.svg)

![Forks](https://img.shields.io/github/forks/decaf-ts/ts-workspace.svg)
![Stars](https://img.shields.io/github/stars/decaf-ts/ts-workspace.svg)
![Watchers](https://img.shields.io/github/watchers/decaf-ts/ts-workspace.svg)

![Node Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Fbadges%2Fshields%2Fmaster%2Fpackage.json&label=Node&query=$.engines.node&colorB=blue)
![NPM Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Fbadges%2Fshields%2Fmaster%2Fpackage.json&label=NPM&query=$.engines.npm&colorB=purple)

Documentation available [here](https://decaf-ts.github.io/ts-workspace/)

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
3. Define models with decorators
   - Use @Entity, @PrimaryGeneratedColumn, @Column, @CreateDateColumn, @UpdateDateColumn, and relation decorators to define your schema and relationships.
4. Use repositories
   - Get a TypeORMRepository for your model from the adapter, perform create/read/update/delete and batch operations.
5. Build queries
   - Create a TypeORMStatement via repository.queryBuilder() to compose filters ordering, and pagination; call paginate(size) to obtain a TypeORMPaginator.
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


# How to Use — Decaf.ts for TypeORM

This guide provides practical, TypeScript-based examples for every exported element of the for-typeorm package.

Note: Importing from `@decaf-ts/for-typeorm` runs `TypeORMAdapter.decoration()` automatically, wiring decorators.


## Core classes

### TypeORMAdapter
- Description: Initialize the adapter with a TypeORM DataSource, perform CRUD, execute raw queries, and wire repositories/statements/paginators.
- TypeScript
```ts
import { DataSource } from 'typeorm';
import {
  TypeORMAdapter,
  TypeORMRepository,
  TypeORMStatement,
  TypeORMPaginator,
} from '@decaf-ts/for-typeorm';
import { Model, prop } from '@decaf-ts/decorator-validation';
import { Entity, PrimaryGeneratedColumn, Column } from '@decaf-ts/for-typeorm';

@Entity()
class User extends Model {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: String })
  @prop()
  name!: string;
}

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL!,
  entities: [User],
});

// Create adapter bound to the DataSource
const adapter = new TypeORMAdapter({ dataSourceOptions: dataSource.options });

// Initialize / connect once
await adapter.initialize();

// Repository factory
const repo: TypeORMRepository<User> = adapter.repository(User);

// CRUD via adapter directly
const created = await adapter.create('user', 'id', User, new User({ name: 'Ada' }));
const fetched = await adapter.read('user', 'id', created.id);

// Raw execution (parameterized)
await adapter.raw({ query: 'SELECT 1 as x', values: [] });
```

### TypeORMRepository
- Description: Strongly-typed CRUD and batch ops for a Model; integrates validation and context flags.
- TypeScript
```ts
import { TypeORMRepository } from '@decaf-ts/for-typeorm';

// repo obtained from adapter.repository(User)
const created = await repo.create(new User({ name: 'Turing' }));
const one = await repo.read(created.id);
const updated = await repo.update(new User({ ...one, name: 'Turing A.' }));
await repo.delete(updated.id);

// Batch helpers
await repo.createAll([new User({ name: 'A' }), new User({ name: 'B' })]);
const users = await repo.readAll([created.id]);
```

### TypeORMStatement
- Description: Statement builder that translates Decaf conditions into TypeORM Find options / QueryBuilder.
- TypeScript
```ts
import { TypeORMStatement } from '@decaf-ts/for-typeorm';
import { Operator, GroupOperator } from '@decaf-ts/core';

const stmt = new TypeORMStatement<User>(adapter)
  .from(User)
  .where({ attr1: 'name', operator: Operator.LIKE, comparison: '%ing%' })
  .orderBy('name', 'ASC');

// Execute via paginator
const paginator = await stmt.paginate<User>(10);
const page1 = await paginator.page(1);
```

### TypeORMPaginator
- Description: Paginates results with take/skip, mapping rows back to Model instances.
- TypeScript
```ts
import { TypeORMPaginator } from '@decaf-ts/for-typeorm';

const paginator = new TypeORMPaginator<User, User>(adapter, { query: {} as any }, 20, User);
const first = await paginator.page(1);
console.log(paginator.count, paginator.total);
```

### TypeORMSequence
- Description: Work with database sequences (e.g., for numeric IDs).
- TypeScript
```ts
import { TypeORMSequence } from '@decaf-ts/for-typeorm';

const seq = new TypeORMSequence({ name: 'invoice_id_seq', type: 'Number', startWith: 1, incrementBy: 1 }, adapter);
const current = await seq.current();
const next = await seq.next();
const range = await seq.range(5); // [next..next+4] depending on increment
```

### TypeORMDispatch and TypeORMEventSubscriber
- Description: Subscribe a DataSource to entity change notifications and propagate updates to observers.
- TypeScript
```ts
import { TypeORMDispatch } from '@decaf-ts/for-typeorm';

const dispatch = new TypeORMDispatch();
dispatch.observe(adapter, dataSource.options); // registers TypeORMEventSubscriber

// Elsewhere, register observers via Decaf.ts Dispatch API (not shown)
```

### IndexError
- Description: Error class for issues related to index generation/handling.
- TypeScript
```ts
import { IndexError } from '@decaf-ts/for-typeorm';

try {
  // imagine a failure in index generation or execution
  throw new IndexError('Index name collision');
} catch (e) {
  if (e instanceof IndexError) {
    console.error('Index error:', e.message);
  }
}
```


## Decorators and Overrides

### Entity, PrimaryGeneratedColumn, Column
- Description: Define an entity and its columns in a Decaf + TypeORM-compatible way.
- TypeScript
```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from '@decaf-ts/for-typeorm';
import { Model, prop } from '@decaf-ts/decorator-validation';

@Entity('users')
class User extends Model {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: String, length: 120 })
  @prop()
  name!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

### Relations: OneToOne, OneToMany, ManyToOne, JoinColumn
- Description: Establish relations across entities.
- TypeScript
```ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, JoinColumn } from '@decaf-ts/for-typeorm';
import { Model, prop } from '@decaf-ts/decorator-validation';

@Entity('profiles')
class Profile extends Model {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: String }) @prop() bio!: string;
}

@Entity('posts')
class Post extends Model {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: String }) @prop() title!: string;
  @ManyToOne(() => User, (u) => u.posts)
  author!: User;
}

@Entity('users')
class User extends Model {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @OneToOne(() => Profile)
  @JoinColumn()
  profile!: Profile;

  @OneToMany(() => Post, (p) => p.author)
  posts!: Post[];
}
```

### PrimaryColumn
- Description: Use a custom primary key definition without generation.
- TypeScript
```ts
import { Entity, PrimaryColumn, Column } from '@decaf-ts/for-typeorm';

@Entity('tokens')
class Token {
  @PrimaryColumn({ type: String })
  token!: string;

  @Column({ type: Date })
  expiresAt!: Date;
}
```

### PrimaryGeneratedColumn
- Description: Use generated primary keys (increment/uuid/rowid/identity).
- TypeScript
```ts
import { Entity, PrimaryGeneratedColumn, Column } from '@decaf-ts/for-typeorm';

@Entity('items')
class Item {
  @PrimaryGeneratedColumn('increment') id!: number;
  @Column({ type: String }) name!: string;
}
```

### CreateDateColumn / UpdateDateColumn
- Description: Automatically maintained timestamps.
- TypeScript
```ts
import { CreateDateColumn, UpdateDateColumn } from '@decaf-ts/for-typeorm';

class Audited {
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
```

### aggregateOrNewColumn (advanced)
- Description: Low-level helper that merges column options or creates a new one (used by overrides). Rarely needed by app code.
- TypeScript
```ts
import { getMetadataArgsStorage } from 'typeorm';
import { aggregateOrNewColumn } from '@decaf-ts/for-typeorm/dist/overrides/utils';

class X { a!: string }
const cols = getMetadataArgsStorage().columns;
aggregateOrNewColumn(X, 'a', cols, { type: String, length: 64 });
```


## Query utilities and operators

### translateOperators
- Description: Map Decaf core operators to SQL/TypeORM operators.
- TypeScript
```ts
import { translateOperators } from '@decaf-ts/for-typeorm';
import { Operator, GroupOperator } from '@decaf-ts/core';

const op1 = translateOperators(Operator.EQUAL);      // '='
const op2 = translateOperators(GroupOperator.AND);   // 'AND'
```

### TypeORMQueryLimit, TypeORMOperator, TypeORMGroupOperator, TypeORMConst
- Description: Constants used by the query builder/translation layer.
- TypeScript
```ts
import { TypeORMQueryLimit, TypeORMOperator, TypeORMGroupOperator, TypeORMConst } from '@decaf-ts/for-typeorm';

console.log(TypeORMQueryLimit); // 250 default page limit
console.log(TypeORMOperator.EQUAL); // '='
console.log(TypeORMGroupOperator.AND); // 'AND'
console.log(TypeORMConst.NULL); // 'NULL'
```

### SQLOperator, TypeORMQuery
- Description: Typed operators and query container shapes.
- TypeScript
```ts
import { SQLOperator, TypeORMQuery } from '@decaf-ts/for-typeorm';

const whereOp: SQLOperator = SQLOperator.LIKE;
const q: TypeORMQuery = { query: 'SELECT * FROM users WHERE name LIKE $1', values: ['A%'] };
```

### TypeORMFlags
- Description: Extended repository flags including user context.
- TypeScript
```ts
import { TypeORMFlags } from '@decaf-ts/for-typeorm';

const flags: Partial<TypeORMFlags> = { user: 'db_user', traceId: 'abc-123' } as any;
```

### TypeORMTableSpec
- Description: Table creation/change description used internally by the adapter.
- TypeScript
```ts
import { TypeORMTableSpec } from '@decaf-ts/for-typeorm';

const spec: TypeORMTableSpec = {
  query: 'ALTER TABLE users ADD COLUMN referrer TEXT',
  values: [],
  primaryKey: false,
  constraints: ['CHECK (char_length(referrer) <= 64)'],
  foreignKeys: [],
};
```


## Index generation

### generateIndexes
- Description: Build SQL statements to create indexes from model metadata; execute them with adapter.raw.
- TypeScript
```ts
import { generateIndexes } from '@decaf-ts/for-typeorm';

const stmts = generateIndexes([User, Post]);
for (const s of stmts) {
  await adapter.raw(s);
}
```


## Constants and helpers

### reservedAttributes, TypeORMKeys, TypeORMFlavour
- Description: Reserved SQL attribute matcher and common keys/labels.
- TypeScript
```ts
import { reservedAttributes, TypeORMKeys, TypeORMFlavour } from '@decaf-ts/for-typeorm';

console.log(reservedAttributes.test('select')); // true
console.log(TypeORMKeys.ID, TypeORMKeys.VERSION);
console.log(TypeORMFlavour); // 'type-orm'
```

### convertJsRegexToPostgres
- Description: Convert a JS RegExp or string (/pattern/flags) into a PostgreSQL POSIX pattern.
- TypeScript
```ts
import { convertJsRegexToPostgres } from '@decaf-ts/for-typeorm';

const pattern = convertJsRegexToPostgres(/foo.*/i); // 'foo.*'
// Use with ~ or ~* in SQL
```

### Raw Postgres typings
- Description: Type helpful shapes for raw Postgres query results when using adapter.raw.
- TypeScript
```ts
import { QueryResult, QueryResultRow } from '@decaf-ts/for-typeorm';

const result = await adapter.raw({ query: 'SELECT id, name FROM users', values: [] }) as QueryResult;
result.rows.forEach((row: QueryResultRow) => console.log(row.id, row.name));
```

### VERSION
- Description: The package version placeholder exported by the entrypoint.
- TypeScript
```ts
import { VERSION } from '@decaf-ts/for-typeorm';
console.log('for-typeorm version:', VERSION);
```


### Related

[![Readme Card](https://github-readme-stats.vercel.app/api/pin/?username=decaf-ts&repo=ts-workspace)](https://github.com/decaf-ts/ts-workspace)

### Social

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/decaf-ts/)




#### Languages

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![NodeJS](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![ShellScript](https://img.shields.io/badge/Shell_Script-121011?style=for-the-badge&logo=gnu-bash&logoColor=white)

## Getting help

If you have bug reports, questions or suggestions please [create a new issue](https://github.com/decaf-ts/ts-workspace/issues/new/choose).

## Contributing

I am grateful for any contributions made to this project. Please read [this](./workdocs/98-Contributing.md) to get started.

## Supporting

The first and easiest way you can support it is by [Contributing](./workdocs/98-Contributing.md). Even just finding a typo in the documentation is important.

Financial support is always welcome and helps keep both me and the project alive and healthy.

So if you can, if this project in any way. either by learning something or simply by helping you save precious time, please consider donating.

## License

This project is released under the [MIT License](./LICENSE.md).

By developers, for developers...