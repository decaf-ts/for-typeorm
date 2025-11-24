import { DataSource } from "typeorm";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { TypeORMAdapter } from "../../src";

const admin = "alfred";
const admin_password = "password";
const user = "nested_cretion_db";
const user_password = "password";
const dbName = "nested_creaton_db";
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
let adapter: TypeORMAdapter;

import { Observer, Repository } from "@decaf-ts/core";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { Prompt } from "./models/Prompt";
import { ContextualizationPrompts } from "./models/contextualization.prompts";
import { AIFeature } from "./models/AIFeature";
import { AIFeatures, AIVendors } from "./models/contants";
import { PromptBlock } from "./models/PromptBlock";
import { AIModel } from "./models/AIModel";
import { AIVendor } from "./models/AIVendor";

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

describe("nested model creation", () => {
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
    adapter = new TypeORMAdapter(typeOrmCfg);
    await adapter.initialize();
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let observer: Observer;
  let mock: any;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.resetAllMocks();
    mock = jest.fn();
    observer = new (class implements Observer {
      refresh(...args: any[]): Promise<void> {
        return mock(...args);
      }
    })();
    // repo.observe(observer);
  });
  //
  // afterEach(() => {
  //   repo.unObserve(observer);
  // });

  afterAll(async () => {
    if (con) await con.destroy();
    await adapter.shutdown();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  let created: Prompt;
  let aiFeature: AIFeature;
  let aiModel: AIModel;
  let aiVendor: AIVendor;

  it("creates a feature", async () => {
    const model = new AIFeature({
      name: AIFeatures.CONTEXTUALIZATION,
      description:
        "Shorten one or more documents into a concise version that keeps the main points and meaning",
    });

    const repo = Repository.forModel(AIFeature);
    aiFeature = await repo.create(model);

    expect(aiFeature).toBeDefined();
    expect(aiFeature.hasErrors()).toBeUndefined();
  });

  it("creates a model", async () => {
    const repo = Repository.forModel(AIModel);
    const model = new AIModel({
      name: "gpt-5",
      contextWindow: 400000,
      features: [aiFeature],
      priceSubscription: 30,
      pricePerTokenInput: 125,
      pricePerTokenOutput: 1000,
    });

    aiModel = await repo.create(model);

    expect(aiModel).toBeDefined();
    expect(aiModel.hasErrors()).toBeUndefined();
  });

  it("creates a vendor", async () => {
    const repo = Repository.forModel(AIVendor);
    const model = new AIVendor({
      name: AIVendors.OPEN_AI,
      models: [aiModel],
    });

    aiVendor = await repo.create(model);

    expect(aiVendor).toBeDefined();
    expect(aiVendor.hasErrors()).toBeUndefined();
  });

  it("creates", async () => {
    const prompt = ContextualizationPrompts[0];

    prompt.feature = aiFeature;
    prompt.models = [aiModel];
    prompt.vendors = [aiVendor];
    Object.entries(prompt).forEach(([, value]) => {
      if (value instanceof PromptBlock) {
        value.features = [aiFeature];
        value.vendors = [aiVendor];
        value.models = [aiModel];
      }
    });

    const repo = Repository.forModel(Prompt);
    created = await repo.create(prompt);

    expect(created).toBeDefined();
    expect(created.hasErrors()).toBeUndefined();
    // await new Promise((resolve) => setTimeout(resolve, 10000));
    // expect(mock).toHaveBeenCalledWith(
    //   Model.tableName(TestModel),
    //   OperationKeys.CREATE,
    //   [model.id]
    // );
  });
});
