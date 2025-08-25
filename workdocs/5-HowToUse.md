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
