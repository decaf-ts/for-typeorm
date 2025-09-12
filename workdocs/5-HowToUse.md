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
