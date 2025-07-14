import {
  BaseModel,
  Condition,
  index,
  OrderDirection,
  pk,
  Repository,
  uses,
} from "@decaf-ts/core";
import {
  min,
  minlength,
  model,
  ModelArg,
  required,
  type,
} from "@decaf-ts/decorator-validation";
import {
  ConflictError,
  InternalError,
  readonly,
} from "@decaf-ts/db-decorators";

import { Pool, PoolConfig } from "pg";
import { PostgresAdapter } from "../../src";
import { PostgresRepository } from "../../src/PostgresRepository";

const admin = "postgres";
const admin_password = "password";
const user = "user";
const user_password = "password";
const dbHost = "localhost";

const config: PoolConfig = {
  user: admin,
  password: admin_password,
  database: "postgres",
  host: dbHost,
  port: 5432,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 10000,
};

const dbName = "queries_db";

jest.setTimeout(50000);

describe("Queries", () => {
  let con: Pool;
  let adapter: PostgresAdapter;

  beforeAll(async () => {
    con = await PostgresAdapter.connect(config);
    expect(con).toBeDefined();
    try {
      await PostgresAdapter.createDatabase(con, dbName);
      await PostgresAdapter.createUser(con, dbName, user, user_password);
    } catch (e: any) {
      if (!(e instanceof ConflictError)) throw e;
    }
    adapter = new PostgresAdapter(con);
  });

  afterAll(async () => {
    await PostgresAdapter.deleteDatabase(con, dbName);
  });

  @uses("nano")
  @model()
  class TestUser extends BaseModel {
    @pk({ type: "Number" })
    id!: number;

    @required()
    @min(18)
    @index([OrderDirection.DSC, OrderDirection.ASC])
    age!: number;

    @required()
    @minlength(5)
    name!: string;

    @required()
    @readonly()
    @type([String.name])
    sex!: "M" | "F";

    constructor(arg?: ModelArg<TestUser>) {
      super(arg);
    }
  }

  let created: TestUser[];

  it("Creates in bulk", async () => {
    const repo: PostgresRepository<TestUser> = Repository.forModel<
      TestUser,
      PostgresRepository<TestUser>
    >(TestUser);
    const models = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
      (i) =>
        new TestUser({
          age: Math.floor(18 + (i - 1) / 3),
          name: "user_name_" + i,
          sex: i % 2 === 0 ? "M" : "F",
        })
    );
    created = await repo.createAll(models);
    expect(created).toBeDefined();
    expect(Array.isArray(created)).toEqual(true);
    expect(created.every((el) => el instanceof TestUser)).toEqual(true);
    expect(created.every((el) => !el.hasErrors())).toEqual(true);
  });

  it("Performs simple queries - full object", async () => {
    const repo: PostgresRepository<TestUser> = Repository.forModel<
      TestUser,
      PostgresRepository<TestUser>
    >(TestUser);
    const selected = await repo.select().execute();
    expect(
      created.every((c) => c.equals(selected.find((s: any) => (s.id = c.id))))
    );
  });

  it("Performs simple queries - attributes only", async () => {
    const repo: PostgresRepository<TestUser> = Repository.forModel<
      TestUser,
      PostgresRepository<TestUser>
    >(TestUser);
    const selected = await repo.select(["age", "sex"]).execute();
    expect(selected).toEqual(
      expect.arrayContaining(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        [...new Array(created.length)].map((e) =>
          expect.objectContaining({
            age: expect.any(Number),
            sex: expect.stringMatching(/^M|F$/g),
          })
        )
      )
    );
  });

  it("Performs conditional queries - full object", async () => {
    const repo: PostgresRepository<TestUser> = Repository.forModel<
      TestUser,
      PostgresRepository<TestUser>
    >(TestUser);
    const condition = Condition.attribute<TestUser>("age").eq(20);
    const selected = await repo.select().where(condition).execute();
    expect(selected.length).toEqual(created.filter((c) => c.age === 20).length);
  });

  it("Performs conditional queries - selected attributes", async () => {
    const repo: PostgresRepository<TestUser> = Repository.forModel<
      TestUser,
      PostgresRepository<TestUser>
    >(TestUser);
    const condition = Condition.attribute<TestUser>("age").eq(20);
    const selected = await repo
      .select(["age", "sex"])
      .where(condition)
      .execute();
    expect(selected.length).toEqual(created.filter((c) => c.age === 20).length);
    expect(selected).toEqual(
      expect.arrayContaining(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        [...new Array(created.length)].map((e: any) =>
          expect.objectContaining({
            age: expect.any(Number),
            sex: expect.stringMatching(/^M|F$/g),
          })
        )
      )
    );
  });

  it("Performs AND conditional queries - full object", async () => {
    const repo: PostgresRepository<TestUser> = Repository.forModel<
      TestUser,
      PostgresRepository<TestUser>
    >(TestUser);
    const condition = Condition.attribute<TestUser>("age")
      .eq(20)
      .and(Condition.attribute<TestUser>("sex").eq("M"));
    const selected = await repo.select().where(condition).execute();
    expect(selected.length).toEqual(
      created.filter((c) => c.age === 20 && c.sex === "M").length
    );
  });

  it("Performs OR conditional queries - full object", async () => {
    const repo = Repository.forModel<TestUser, PostgresRepository<TestUser>>(
      TestUser
    );
    const condition = Condition.attribute<TestUser>("age")
      .eq(20)
      .or(Condition.attribute<TestUser>("age").eq(19));
    const selected = await repo.select().where(condition).execute();
    expect(selected.length).toEqual(
      created.filter((c) => c.age === 20 || c.age === 19).length
    );
  });

  it("fails to Sorts attribute without indexes", async () => {
    const repo: PostgresRepository<TestUser> = Repository.forModel<
      TestUser,
      PostgresRepository<TestUser>
    >(TestUser);
    await expect(() =>
      repo.select().orderBy(["name", OrderDirection.DSC]).execute()
    ).rejects.toThrow(InternalError);
  });

  it("Sorts attribute when indexed", async () => {
    await adapter.initialize();
    const repo: PostgresRepository<TestUser> = Repository.forModel<
      TestUser,
      PostgresRepository<TestUser>
    >(TestUser);
    const sorted = await repo
      .select()
      .orderBy(["age", OrderDirection.DSC])
      .execute();
    expect(sorted).toBeDefined();
    expect(sorted.length).toEqual(created.length);

    expect(sorted[sorted.length - 1]).toEqual(
      expect.objectContaining(created[0])
    );

    expect(
      sorted.reverse().every((s: any, i: number) => s.equals(created[i]))
    ).toEqual(true);
  });
});
