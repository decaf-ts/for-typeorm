import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMAdapter, TypeORMFlavour, TypeORMRepository } from "../../src";
import { Logging, LogLevel } from "@decaf-ts/logging";

const admin = "alfred";
const admin_password = "password";
const user = "agg_query_user";
const user_password = "password";
const dbHost = "localhost";

const config: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
  ssl: false,
};
let con: DataSource;
Logging.setConfig({
  level: LogLevel.debug,
});
let adapter: TypeORMAdapter;

import {
  column,
  Condition,
  index,
  OrderDirection,
  pk,
  Repository,
  table,
} from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
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
  NotFoundError,
  readonly,
} from "@decaf-ts/db-decorators";

import { TypeORMBaseModel } from "./baseModel";
const dbName = "agg_queries_db";

jest.setTimeout(50000);

const typeOrmCfg: DataSourceOptions = {
  type: "postgres",
  host: dbHost,
  port: 5432,
  username: user,
  password: user_password,
  database: dbName,
  synchronize: true,
  logging: false,
};

@uses(TypeORMFlavour)
@table("tst_agg_user")
@model()
class AggUser extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column("tst_age")
  @required()
  @min(18)
  @index([OrderDirection.DSC, OrderDirection.ASC])
  age!: number;

  @column("tst_score")
  @required()
  score!: number;

  @column("tst_name")
  @required()
  @minlength(5)
  name!: string;

  @column("tst_sex")
  @required()
  @readonly()
  @type([String])
  sex!: "M" | "F";

  @column("tst_category")
  @required()
  category!: string;

  constructor(arg?: ModelArg<AggUser>) {
    super(arg);
  }
}

describe("Aggregate Queries", () => {
  beforeAll(async () => {
    con = await TypeORMAdapter.connect(config);
    expect(con).toBeDefined();

    try {
      await TypeORMAdapter.deleteDatabase(con, dbName, user);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await TypeORMAdapter.deleteUser(con, user, admin);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await TypeORMAdapter.createDatabase(con, dbName);
      await con.destroy();
      con = await TypeORMAdapter.connect(
        Object.assign({}, config, {
          database: dbName,
        })
      );
      await TypeORMAdapter.createUser(con, dbName, user, user_password);
      await TypeORMAdapter.createNotifyFunction(con, user);
      await con.destroy();
      con = undefined as any;
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }
    adapter = new TypeORMAdapter(typeOrmCfg);
    try {
      await adapter.initialize();
    } catch (e: unknown) {
      console.error(e);
      throw e;
    }
  });

  afterAll(async () => {
    if (con) await con.destroy();
    await adapter.shutdown();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  let created: AggUser[] = [];
  const size = 30;

  it("Creates test data in bulk", async () => {
    const repo: TypeORMRepository<AggUser> = Repository.forModel<
      AggUser,
      TypeORMRepository<AggUser>
    >(AggUser);
    const categories = ["A", "B", "C"];
    const models = Object.keys(new Array(size).fill(0))
      .map((e) => parseInt(e) + 1)
      .map(
        (i) =>
          new AggUser({
            age: Math.floor(18 + (i - 1) / 3),
            score: i * 10,
            name: "user_name_" + i,
            sex: i % 2 === 0 ? "M" : "F",
            category: categories[i % 3],
          })
      );
    created = await repo.createAll(models);
    expect(created).toBeDefined();
    expect(Array.isArray(created)).toEqual(true);
    expect(created.every((el) => el instanceof AggUser)).toEqual(true);
    expect(created.every((el) => !el.hasErrors())).toEqual(true);
  });

  describe("COUNT operations", () => {
    it("Performs COUNT(*)", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const count = await repo.count().execute();
      expect(count).toEqual(created.length);
    });

    it("Performs COUNT(field)", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const count = await repo.count("age").execute();
      expect(count).toEqual(created.length);
    });

    it("Performs COUNT with WHERE", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const condition = Condition.attribute<AggUser>("sex").eq("M");
      const count = await repo.count().where(condition).execute();
      expect(count).toEqual(created.filter((c) => c.sex === "M").length);
    });

    it("Performs COUNT DISTINCT", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const count = await repo.count("age").distinct().execute();
      const uniqueAges = new Set(created.map((c) => c.age)).size;
      expect(count).toEqual(uniqueAges);
    });
  });

  describe("SUM operations", () => {
    it("Performs SUM", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const sum = await repo.sum("score").execute();
      const expectedSum = created.reduce((acc, c) => acc + c.score, 0);
      expect(sum).toEqual(expectedSum);
    });

    it("Performs SUM with WHERE", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const condition = Condition.attribute<AggUser>("category").eq("A");
      const sum = await repo.sum("score").where(condition).execute();
      const expectedSum = created
        .filter((c) => c.category === "A")
        .reduce((acc, c) => acc + c.score, 0);
      expect(sum).toEqual(expectedSum);
    });
  });

  describe("AVG operations", () => {
    it("Performs AVG", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const avg = await repo.avg("age").execute();
      const expectedAvg =
        created.reduce((acc, c) => acc + c.age, 0) / created.length;
      expect(Number(avg)).toBeCloseTo(expectedAvg, 2);
    });

    it("Performs AVG with WHERE", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const condition = Condition.attribute<AggUser>("sex").eq("F");
      const avg = await repo.avg("score").where(condition).execute();
      const filtered = created.filter((c) => c.sex === "F");
      const expectedAvg =
        filtered.reduce((acc, c) => acc + c.score, 0) / filtered.length;
      expect(Number(avg)).toBeCloseTo(expectedAvg, 2);
    });
  });

  describe("MAX/MIN operations", () => {
    it("Performs MAX", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const max = await repo.max("score").execute();
      const expectedMax = Math.max(...created.map((c) => c.score));
      expect(Number(max)).toEqual(expectedMax);
    });

    it("Performs MIN", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const min = await repo.min("age").execute();
      const expectedMin = Math.min(...created.map((c) => c.age));
      expect(Number(min)).toEqual(expectedMin);
    });

    it("Performs MAX with WHERE", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const condition = Condition.attribute<AggUser>("category").eq("B");
      const max = await repo.max("score").where(condition).execute();
      const filtered = created.filter((c) => c.category === "B");
      const expectedMax = Math.max(...filtered.map((c) => c.score));
      expect(Number(max)).toEqual(expectedMax);
    });
  });

  describe("DISTINCT operations", () => {
    it("Performs DISTINCT", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const distinct = await repo.distinct("category").execute();
      expect(distinct).toHaveLength(3); // A, B, C
      expect(distinct.sort()).toEqual(["A", "B", "C"]);
    });
  });

  describe("BETWEEN operator", () => {
    it("Performs BETWEEN query", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const condition = Condition.attribute<AggUser>("age").between(19, 21);
      const results = await repo.select().where(condition).execute();
      const expected = created.filter((c) => c.age >= 19 && c.age <= 21);
      expect(results.length).toEqual(expected.length);
    });

    it("Performs BETWEEN with AND", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const condition = Condition.attribute<AggUser>("age")
        .between(19, 21)
        .and(Condition.attribute<AggUser>("sex").eq("M"));
      const results = await repo.select().where(condition).execute();
      const expected = created.filter(
        (c) => c.age >= 19 && c.age <= 21 && c.sex === "M"
      );
      expect(results.length).toEqual(expected.length);
    });
  });

  describe("Multi-level ORDER BY (thenBy)", () => {
    it("Sorts by multiple attributes", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const sorted = await repo
        .select()
        .orderBy(["category", OrderDirection.ASC])
        .thenBy(["age", OrderDirection.DSC])
        .execute();
      expect(sorted).toBeDefined();
      expect(sorted.length).toEqual(created.length);

      // Verify primary sort by category (ascending)
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (prev.category === curr.category) {
          // Same category - verify secondary sort by age (descending)
          expect(prev.age).toBeGreaterThanOrEqual(curr.age);
        } else {
          // Different category - verify category order
          expect(
            prev.category.localeCompare(curr.category)
          ).toBeLessThanOrEqual(0);
        }
      }
    });

    it("Sorts by three levels", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const sorted = await repo
        .select()
        .orderBy(["sex", OrderDirection.ASC])
        .thenBy(["category", OrderDirection.ASC])
        .thenBy(["score", OrderDirection.DSC])
        .execute();
      expect(sorted).toBeDefined();
      expect(sorted.length).toEqual(created.length);

      // Verify the first level sort
      const femaleFirst = sorted.filter((s) => s.sex === "F");
      const maleAfter = sorted.filter((s) => s.sex === "M");
      const firstFemaleIdx = sorted.findIndex((s) => s.sex === "F");
      const firstMaleIdx = sorted.findIndex((s) => s.sex === "M");

      if (femaleFirst.length > 0 && maleAfter.length > 0) {
        expect(firstFemaleIdx).toBeLessThan(firstMaleIdx);
      }
    });
  });

  describe("IN operator", () => {
    it("Performs IN query", async () => {
      const repo: TypeORMRepository<AggUser> = Repository.forModel(AggUser);
      const condition = Condition.attribute<AggUser>("category").in(["A", "C"]);
      const results = await repo.select().where(condition).execute();
      const expected = created.filter(
        (c) => c.category === "A" || c.category === "C"
      );
      expect(results.length).toEqual(expected.length);
    });
  });
});
