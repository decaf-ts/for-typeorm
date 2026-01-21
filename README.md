![Banner](./workdocs/assets/decaf-logo.svg)

# Decaf.ts — TypeORM Integration

A thin, focused TypeORM-backed adapter that plugs Decaf.ts models, repositories and query primitives into relational databases via TypeORM, keeping the same API you use across other Decaf adapters. It provides:
- TypeORMAdapter: connection management, CRUD/bulk ops, raw SQL, schema helpers, sequences, indexes, error translation
- TypeORMRepository: typed CRUD with validation, context/flags, observers, and access to the native TypeORM repository
- Query layer: TypeORMStatement and TypeORMPaginator for translating Decaf statements to TypeORM options/builders and paginating results
- Decorator wiring: automatically wires Decaf decorators to TypeORM metadata on import (no need to use TypeORM decorators directly)
- Utilities and types: constants, operator translation, raw Postgres types, and small helpers like convertJsRegexToPostgres

> Release docs refreshed on 2025-11-26. See [workdocs/reports/RELEASE_NOTES.md](./workdocs/reports/RELEASE_NOTES.md) for ticket summaries.

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

Minimal size: 12.5 KB kb gzipped


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


# How to Use — Decaf.ts for TypeORM

This guide provides practical, TypeScript examples for the public APIs exported by `@decaf-ts/for-typeorm`.

Notes:
- Importing from `@decaf-ts/for-typeorm` runs `TypeORMAdapter.decoration()` automatically, wiring Decaf decorators to TypeORM metadata.
- Examples mirror the usage found in the package tests under `for-typeorm/tests`.

## Setup the adapter and DataSource

```ts
import { TypeORMAdapter, TypeORMFlavour } from "@decaf-ts/for-typeorm";
import { DataSource, DataSourceOptions } from "typeorm";

// Admin connection (used to create db/user)
const adminOptions: DataSourceOptions = {
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "postgres",
  password: "password",
  database: "postgres",
};

// App database name and user
const dbName = "app_db";
const appUser = "app_user";
const appPass = "password";

// 1) Connect as admin and prepare database and user
const admin = await TypeORMAdapter.connect(adminOptions);
try {
  await TypeORMAdapter.createDatabase(admin, dbName);
  await TypeORMAdapter.createUser(admin, dbName, appUser, appPass);
  await TypeORMAdapter.createNotifyFunction(admin, appUser);
} finally {
  await admin.destroy();
}

// 2) Application DataSource and adapter
const appOptions: DataSourceOptions = {
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: appUser,
  password: appPass,
  database: dbName,
  synchronize: true,
  logging: false,
};

const adapter = new TypeORMAdapter(appOptions);
// Optionally inject an existing DataSource instance
adapter["_dataSource"] = new DataSource(appOptions);
```

## Define a model with Decaf decorators

Use Decaf decorators (@model, @table, @pk, @column, etc.). They are wired to TypeORM automatically by this package.

```ts
import { model, ModelArg } from "@decaf-ts/decorator-validation";
import {
  table,
  pk,
  column,
  required,
  oneToOne,
  oneToMany,
  manyToOne,
  manyToMany,
  Repository,
  uses,
} from "@decaf-ts/core";
import { TypeORMFlavour, TypeORMRepository } from "@decaf-ts/for-typeorm";
import { Cascade } from "@decaf-ts/db-decorators";

/**
 * User ↔ Profile: one-to-one
 * User → Post: one-to-many
 * Post → User: many-to-one
 * Post ↔ Tag: many-to-many
 */

@uses(TypeORMFlavour)
@table("app_user")
@model()
class AppUser extends Model {
  @pk({ type: "Number" })
  id!: number;

  @required()
  @column("name")
  @minlength(3)
  @maxlength(255)
  @index()
  name!: string;

  @required()
  @column("email")
  @email()
  @index()
  email!: string;

  @column("is_active")
  isActive: boolean = true;

  @column("created_at")
  @createdAt()
  createdAt: Date;

  // oneToOne: each user has exactly one profile
  @oneToOne(
    () => UserProfile,
    {
      update: Cascade.CASCADE,
      delete: Cascade.SET_NULL,
    },
    true // populate
  )
  @required()
  profile!: UserProfile;

  // oneToMany: user has many posts (inverse in Post.author as manyToOne)
  @oneToMany(
    () => Post,
    {
      update: Cascade.CASCADE,
      delete: Cascade.CASCADE,
    },
    true // populate
  )
  posts?: Post[];

  constructor(arg?: ModelArg<AppUser>) {
    super(arg);
  }
}

@uses(TypeORMFlavour)
@table("user_profile")
@model()
class UserProfile extends Model {
  @pk({ type: "Number" })
  id!: number;

  @column("bio")
  bio?: string;

  @column("age")
  @min(0)
  @max(150)
  @step(1)
  @required()
  age!: number;
  
  @column("avatar_url")
  @url()
  avatarUrl?: string;

  @column("phone")
  @index()
  phone?: string;
  
  @column("created_at")
  @createdAt()
  updatedAt: Date;
  
  @column("updated_at")
  @updatedAt()
  updatedAt: Date;

  // Optional back-reference to the user (many projects omit the reverse one-to-one)
  @oneToOne(
    () => AppUser,
    {
      update: Cascade.CASCADE,
      delete: Cascade.CASCADE,
    },
    true
  )
  @required()
  user!: AppUser;

  constructor(arg?: ModelArg<UserProfile>) {
    super(arg)
  }
}

@uses(TypeORMFlavour)
@table("post")
@model()
class Post extends Model {
  @pk({ type: "Number" })
  id!: number;

  @required()
  @column("title")
  @index()
  title!: string;

  @required()
  @column("body")
  body!: string;

  @column("published_at")
  publishedAt?: Date;

  @column("is_published")
  isPublished: boolean = false;

  // manyToOne: each post belongs to a single user (inverse of AppUser.posts)
  @manyToOne(
    () => AppUser,
    {
      update: Cascade.NONE,
      delete: Cascade.SET_NULL,
    },
    false // only one side of the relation can be eager
  )
  author!: AppUser;

  // manyToMany: posts can have many tags and tags can belong to many posts
  @manyToMany(
    () => Tag,
    {
      update: Cascade.NONE,
      delete: Cascade.NONE,
    },
    true // populate
  )
  tags?: Tag[];

  constructor(arg?: ModelArg<Post>) {
    super(arg)
  }
}

@uses(TypeORMFlavour)
@table()
@model()
class Tag extends Model {
  @pk({ type: "Number" })
  id!: number;

  @required()
  @column()
  @index()
  name!: string;

  @column()
  color?: string;

  // Optional reverse manyToMany side
  @manyToMany(
    () => Post,
    {
      update: Cascade.NONE,
      delete: Cascade.NONE,
    },
    true
  )
  posts?: Post[];

  constructor(arg?: ModelArg<Tag>) {
    super(arg)
  }
}

// Example: create a user with profile, posts and tags in one go
const userRepo: TypeORMRepository<AppUser> = Repository.forModel(AppUser);
const tagRepo: TypeORMRepository<Tag> = Repository.forModel(Tag);

const t1 = await tagRepo.create(new Tag({ name: "typescript", color: "#3178C6" }));
const t2 = await tagRepo.create(new Tag({ name: "orm" }));

const createdUser = await userRepo.create(
  new AppUser({
    name: "Alice",
    email: "alice@example.com",
    profile: { 
      bio: "Full-stack dev", 
      phone: "+1-555-1234" 
    },
    posts: [
      {
        title: "Hello World",
        body: "My first post",
        isPublished: true,
        tags: [t1, t2],
      },
      {
        title: "TypeORM Tips",
        body: "Relations and cascading",
        tags: [t1],
      },
    ],
  })
);

// Read back with relations populated (populate=true in decorators)
const fetched = await userRepo.read(createdUser.id);
```

## Repository CRUD operations

```ts
import { OperationKeys } from "@decaf-ts/db-decorators";
import { Observer } from "@decaf-ts/core";

// Observe changes
const mock = jest.fn(); // or any function
const observer: Observer = { refresh: (...args) => Promise.resolve(mock(...args)) };
repo.observe(observer);

// Create
const created = await repo.create(new User({ name: "Alice", nif: "123456789" }));
// Read
const fetched = await repo.read(created.id);
// Update
created.name = "Alice Doe";
const updated = await repo.update(created);
// Delete
await repo.delete(updated.id);

// Bulk operations
const many = [
  new User({ name: "u1", nif: "111111111" }),
  new User({ name: "u2", nif: "222222222" }),
];
const createdAll = await repo.createAll(many);
const readAll = await repo.readAll(createdAll.map(u => u.id));
const updatedAll = await repo.updateAll(readAll.map(u => ({ ...u, name: u.name + "!" }) as User));
await repo.deleteAll(updatedAll.map(u => u.id));
```

## Native TypeORM repository and QueryBuilder access

```typescript
import { TypeORMRepository } from "@decaf-ts/for-typeorm"
// Access the underlying TypeORM Repository
const repo: TypeORMRepository = Repository.forModel(User);
const nativeRepo = repo.nativeRepository();

// Or build a TypeORM query using queryBuilder()
const qb = repo.queryBuilder<User>(); // returns a QueryBuilder<User>
const rows = await qb.select("user").where({ name: "Alice" }).getMany();
```

## Decaf Statement with pagination

```ts
import { Operator, Condition, Repository } from "@decaf-ts/core";
const repo: TypeORMRepository = Repository.forModel(User);

// Build a Decaf statement and paginate
const stmt = repo
  .select()
  .where(Condition.attr<User>("name").eq("Alice"))
  .orderBy("id")
  .paginate(10); // TypeORMPaginator under the hood

const page1 = await stmt.page(1); // User[]
```


## TypeORMDispatch and live updates

Description: Subscribe to TypeORM entity events and notify Decaf observers on CREATE/UPDATE/DELETE. Based on tests/integration/dispatch-subscriber.test.ts.

```ts
import { TypeORMDispatch, TypeORMAdapter } from "@decaf-ts/for-typeorm";
import { Repository, Observer } from "@decaf-ts/core";
import { OperationKeys } from "@decaf-ts/db-decorators";
import { DataSourceOptions } from "typeorm";

// Assume you already created the DB and user
const options: DataSourceOptions = { /* postgres options */ } as any;
const adapter = new TypeORMAdapter(options);

// Observe repository changes
const repo = Repository.forModel(User);
const spy = jest.fn();
const observer: Observer = { refresh: (t, op, ids) => Promise.resolve(spy(t, op, ids)) };
repo.observe(observer);

// Start dispatch
const dispatch = new TypeORMDispatch();
await dispatch.observe(adapter, options);

// After create/update/delete through the repo, your observer will be notified
await repo.create(new User({ name: "Bob", nif: "999999990" }));
expect(spy).toHaveBeenCalledWith(repo.table, OperationKeys.CREATE, expect.any(Array));
```

## TypeORMEventSubscriber (manual registration)

Description: Register the subscriber in a DataSource to forward TypeORM events. Used implicitly by TypeORMDispatch; shown here for completeness.

```ts
import { TypeORMEventSubscriber } from "@decaf-ts/for-typeorm";
import { DataSource, DataSourceOptions } from "typeorm";

const options: DataSourceOptions = { /* postgres options */ } as any;
const ds = new DataSource({ ...options, subscribers: [new TypeORMEventSubscriber((table, op, ids) => {
  console.log("Changed:", table, op, ids);
})] });
await ds.initialize();
```

## translateOperators and SQLOperator

Description: Translate Decaf operators to TypeORM SQL operators; useful when building custom WHERE clauses. Based on src/query/translate.ts and query/constants.

```ts
import { translateOperators } from "@decaf-ts/for-typeorm";
import { Operator, GroupOperator } from "@decaf-ts/core";

const eq = translateOperators(Operator.EQUAL);      // "="
const ne = translateOperators(Operator.DIFFERENT);  // "<>"
const and = translateOperators(GroupOperator.AND);  // "AND"
```

## convertJsRegexToPostgres

Description: Convert a JS RegExp or string form to a PostgreSQL POSIX pattern string for use with ~ / ~*.

```ts
import { convertJsRegexToPostgres } from "@decaf-ts/for-typeorm";

convertJsRegexToPostgres(/foo.*/i); // "foo.*"
convertJsRegexToPostgres("/bar.+/g"); // "bar.+"
```

## splitEagerRelations

Description: Compute eager vs. non-eager relations for a Model class based on relation decorators. Mirrors behavior used by the adapter and statement builder.

```ts
import { splitEagerRelations } from "@decaf-ts/for-typeorm";

const { relations, nonEager } = splitEagerRelations(User);
// relations might include ["posts", "profile", "posts.tags"] depending on your decorators
```

## Sequences (TypeORMSequence)

Description: Work with PostgreSQL sequences through the adapter. Based on tests/integration/sequences.test.ts.

```ts
import { TypeORMSequence } from "@decaf-ts/for-typeorm";

const seq = new TypeORMSequence({ name: "user_id_seq", type: "Number", startWith: 1, incrementBy: 1 }, adapter);
const nextValue = await seq.next();
const batch = await seq.range(5); // e.g., [2,3,4,5,6]
```

## Index generation (generateIndexes)

Description: Generate SQL statements to create indexes defined via decorators. Use adapter.raw to execute them. Based on adapter.index() and indexes/generator.

```ts
import { generateIndexes, TypeORMAdapter } from "@decaf-ts/for-typeorm";

const stmts = generateIndexes([User, Post]); // returns TypeORMQuery[] with raw SQL and values
for (const st of stmts) {
  await adapter.raw(st);
}
```


## Decorator mapping: decaf-ts decorators ➜ TypeORM

The TypeORM adapter wires Decaf decorators into TypeORM metadata automatically on import. The following table summarizes the mapping observed in the adapter code and tests (including the vanilla TypeORM comparison tests):

| Decaf decorator | TypeORM counterpart                                                                                                                | Notes |
|---|------------------------------------------------------------------------------------------------------------------------------------|---|
| @model() + @table(name?) | @Entity({ name })                                                                                                                  | Decaf models are entities; when no name is provided, TypeORM uses the class/table naming strategy. |
| @pk({ type, generated? }) | @PrimaryGeneratedColumn() or @PrimaryColumn()                                                                                      | Generated numeric/bigint keys map to PrimaryGeneratedColumn; otherwise PrimaryColumn with the given type. |
| @column(name?) | @Column({ name })                                                                                                                  | Additional type/length/precision options flow through from the Decaf type metadata. |
| @unique() | @Column({ unique: true })                                                                                                          | Marks the column as unique. |
| @required() | @Column({ nullable: false })                                                                                                       | Forces NOT NULL at the column level. |
| (no @required()) | @Column({nullable: true})                                                                                   | Column nullability follows TypeORM defaults unless overridden by other constraints/validators. |
| @version() | @VersionColumn()                                                                                                                   | Optimistic locking/version field. |
| @createdAt() | @CreateDateColumn()                                                                                                                | Auto-managed creation timestamp. |
| @updatedAt() | @UpdateDateColumn()                                                                                                                | Auto-managed update timestamp. |
| @oneToOne(() => Clazz, cascade, populate, joinColumnOpts?, fkName?) | @OneToOne(() => Clazz, { cascade, onDelete, onUpdate, eager, nullable: true }) + @JoinColumn({ foreignKeyConstraintName: fkName? }) | populate => eager; Cascade.DELETE/UPDATE map to CASCADE, else DEFAULT. Owning side uses JoinColumn. |
| @manyToOne(() => Clazz, cascade, populate, joinOpts?, fkName?) | @ManyToOne(() => Clazz, { cascade, onDelete, onUpdate, eager, nullable: true })                                                    | Owning side; FK constraint name may be set via metadata.name; JoinColumn is not explicitly added by the adapter (TypeORM will create the FK). |
| @oneToMany(() => Clazz, cascade, populate, joinOpts?) | @OneToMany(() => Clazz, inversePropertyResolver, { cascade, onDelete, onUpdate, eager, nullable: true })                           | Inverse side of many-to-one; no JoinColumn/JoinTable applied. |
| @manyToMany(() => Clazz, cascade, populate, joinTableOpts?) | @ManyToMany(() => Clazz, { cascade, onDelete, onUpdate, eager, nullable: true }) + @JoinTable(joinTableOpts?)                      | Owning side applies JoinTable. |
| @index(directionsOrName?, compositionsOrName?) | @Index()                                                                                                                           | Single or composite indexes are registered; when compositions are present, Index([prop, ...compositions]). |


## Coding Principles

- group similar functionality in folders (analog to namespaces but without any namespace declaration)
- one class per file;
- one interface per file (unless interface is just used as a type);
- group types as other interfaces in a types.ts file per folder;
- group constants or enums in a constants.ts file per folder;
- group decorators in a decorators.ts file per folder;
- always import from the specific file, never from a folder or index file (exceptions for dependencies on other packages);
- prefer the usage of established design patters where applicable:
  - Singleton (can be an anti-pattern. use with care);
  - factory;
  - observer;
  - strategy;
  - builder;
  - etc;

## Release Documentation Hooks
Stay aligned with the automated release pipeline by reviewing [Release Notes](./workdocs/reports/RELEASE_NOTES.md) and [Dependencies](./workdocs/reports/DEPENDENCIES.md) after trying these recipes (updated on 2025-11-26).


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

This project is released under the [Mozilla Public License 2.0](./LICENSE.md).

By developers, for developers...
