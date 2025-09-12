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
import { table, pk, column, Repository, uses } from "@decaf-ts/core";
import { TypeORMFlavour, TypeORMRepository } from "@decaf-ts/for-typeorm";

@uses(TypeORMFlavour)
@table("tst_user")
@model()
class User {
  @pk({ type: "Number" })
  id!: number;

  @column("tst_name")
  name!: string;

  @column("tst_nif")
  nif!: string;

  constructor(arg?: ModelArg<User>) {
    Object.assign(this, arg);
  }
}

// Get the repository (TypeORMRepository)
const repo: TypeORMRepository<User> = Repository.forModel(User);
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

```ts
// Access the underlying TypeORM Repository
const nativeRepo = repo["typeormRepo"]?.(); // or (repo as any).typeormRepo()

// Or build a TypeORM query using queryBuilder()
const qb = (repo as any).queryBuilder<User>(); // returns a SelectQueryBuilder<User>
const rows = await qb.select("user").where({ name: "Alice" }).getMany();
```

## Decaf Statement with pagination

```ts
import { Operator } from "@decaf-ts/core";

// Build a Decaf statement and paginate
const stmt = repo
  .select()
  .where("name", Operator.EQUAL, "Alice")
  .orderBy("id")
  .paginate(10); // TypeORMPaginator under the hood

const page1 = await stmt.page(1); // User[]
```

## translateOperators

```ts
import { GroupOperator, Operator } from "@decaf-ts/core";
import { translateOperators } from "@decaf-ts/for-typeorm";

const sqlEq = translateOperators(Operator.EQUAL); // SQLOperator '='
const sqlAnd = translateOperators(GroupOperator.AND); // 'AND'
```

## Index generation

```ts
import { generateIndexes } from "@decaf-ts/for-typeorm";
import { Constructor } from "@decaf-ts/decorator-validation";

const queries = generateIndexes([User as unknown as Constructor<User>]);
// Adapter can execute these via raw()
for (const q of queries) {
  if (typeof q.query === "string") {
    await adapter.raw(q);
  }
}
```

## Sequences

```ts
import { TypeORMSequence } from "@decaf-ts/for-typeorm";

const seq = new TypeORMSequence({
  name: "user_id_seq",
  type: "Number",
  startWith: 1,
  incrementBy: 1,
}, adapter);

const current = await seq.current();
const next = await seq.next();
const range = await seq.range(5);
```

## TypeORMDispatch (observe DB changes)

```ts
import { TypeORMDispatch } from "@decaf-ts/for-typeorm";

const dispatch = new TypeORMDispatch();
// Provide adapter and native DataSource options
await dispatch.observe(adapter, adapter.dataSource.options);
// Observers added on repositories will receive OperationKeys notifications
```

## Utilities: convertJsRegexToPostgres

```ts
import { convertJsRegexToPostgres } from "@decaf-ts/for-typeorm";

const pattern = convertJsRegexToPostgres(/foo.*/i); // "foo.*"
// Use with REGEXP/IREGEXP operators inside custom queries
```

## Constants and types

```ts
import { TypeORMKeys, TypeORMFlavour, TypeORMQuery, SQLOperator } from "@decaf-ts/for-typeorm";

// Keys/constants
console.log(TypeORMKeys.TABLE); // "table_name"
console.log(TypeORMFlavour); // "type-orm"

// TypeORMQuery typing
type Q = TypeORMQuery; // { query: string | SelectQueryBuilder<M>; values?: any[] }
const op: SQLOperator = SQLOperator.EQUAL;
```

## Errors

```ts
import { IndexError } from "@decaf-ts/for-typeorm";

try {
  throw new IndexError("Index not found");
} catch (e) {
  if (e instanceof IndexError) {
    // handle index error
  }
}
```
