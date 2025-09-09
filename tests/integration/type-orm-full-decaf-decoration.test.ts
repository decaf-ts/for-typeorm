import { TypeORMAdapter } from "../../src";
import { DataSource, DataSourceOptions } from "typeorm";

const admin = "alfred";
const admin_password = "password";
const user = "orm_full_decaf_user";
const user_password = "password";
const dbName = "orm_full_decaf_db";
const dbHost = "localhost";

const config: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
} as PostgresConnectionOptions;

let con: DataSource;
const adapter = new TypeORMAdapter(config);

import { ModelKeys } from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { Repository } from "@decaf-ts/core";
import { AIFeature } from "./models/AIFeature";
import { AIModel } from "./models/AIModel";
import { SupportedAIFeatures } from "./models/features.models";

jest.setTimeout(50000);

const typeOrmCfg = {
  type: "postgres",
  host: dbHost,
  port: 5432,
  username: user,
  password: user_password,
  database: dbName,
  synchronize: true,
  logging: false,
};

describe.skip("TypeORM Decaf full decoration", () => {
  let dataSource: DataSource;

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
      con = undefined;
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }
    dataSource = new DataSource(
      Object.assign({}, typeOrmCfg, {
        entities: [AIFeature[ModelKeys.ANCHOR], AIModel[ModelKeys.ANCHOR]],
      }) as DataSourceOptions
    );

    adapter["_dataSource"] = dataSource;
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (con) await con.destroy();
    await dataSource.destroy();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  const features: Record<string, AIFeature> = {};

  SupportedAIFeatures.forEach((feature) => {
    it(`creates ${feature.name} feature`, async () => {
      const repo = Repository.forModel(AIFeature);
      expect(repo).toBeDefined();
      const record = await repo.create(feature);
      expect(record).toBeDefined();
      expect(record.hasErrors()).toBeUndefined();
      features[record.name] = record;
    });
  });

  it("creates an AIModel with existing feature", async () => {
    const repo = Repository.forModel(AIModel);
    expect(repo).toBeDefined();
    const toCreate = new AIModel({
      name: "gpt-1",
      contextWindow: 1024,
      features: Object.values(features),
      priceSubscription: 30,
      pricePerTokenInput: 10,
      pricePerTokenOutput: 10,
      active: true,
    });
    const record = await repo.create(toCreate);
    expect(record).toBeDefined();
    expect(record.hasErrors()).toBeUndefined();
  });

  it("fails to create an AIModel with new feature since no cascade", async () => {
    const repo = Repository.forModel(AIModel);
    expect(repo).toBeDefined();
    const toCreate = new AIModel({
      name: "gpt-2",
      contextWindow: 1024,
      features: [
        new AIFeature({
          name: "new-one",
          description:
            "Split a document into a sequence of tokens, which are the basic units of information in natural language",
        }),
      ],
      priceSubscription: 30,
      pricePerTokenInput: 10,
      pricePerTokenOutput: 10,
      active: true,
    });

    await expect(() => repo.create(toCreate)).rejects.toThrowError();
  });
});
