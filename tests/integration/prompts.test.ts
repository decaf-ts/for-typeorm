import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMAdapter } from "../../src";
import { ModelKeys } from "@decaf-ts/decorator-validation";
import { Condition, Observer, Repository } from "@decaf-ts/core";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { PromptBlock } from "./models/PromptBlock";
import { Prompt } from "./models/Prompt";
import { AIFeatures, AIVendors, PromptBlockType } from "./models/contants";
import { AIFeature } from "./models/AIFeature";
import { AIModel } from "./models/AIModel";
import { AIVendor } from "./models/AIVendor";

const admin = "alfred";
const admin_password = "password";
const user = "prompt_user";
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
const adapter = new TypeORMAdapter(config);

const dbName = "prompts_db";

jest.setTimeout(500000);

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

describe(`Prompt Relations`, function () {
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
        entities: [
          AIFeature[ModelKeys.ANCHOR],
          AIModel[ModelKeys.ANCHOR],
          AIVendor[ModelKeys.ANCHOR],
          PromptBlock[ModelKeys.ANCHOR],
          Prompt[ModelKeys.ANCHOR],
        ],
      }) as DataSourceOptions
    );
    await dataSource.initialize();
    adapter["_dataSource"] = dataSource;
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
    await dataSource.destroy();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  let feature: AIFeature;
  let model: AIModel;
  let vendor: AIVendor;
  let prompt: Prompt;

  it("creates a feature", async () => {
    const toCreate = new AIFeature({
      name: AIFeatures.CONTEXTUALIZATION,
      description: "contextualization",
    });

    const repo = Repository.forModel(AIFeature);
    try {
      feature = await repo.create(toCreate);
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
      feature = await repo.read(AIFeatures.CONTEXTUALIZATION);
    }
    expect(feature).toBeDefined();
    expect(feature.hasErrors()).toBeUndefined();
  });

  it("creates a vendor/model", async () => {
    const toCreate = new AIVendor({
      name: AIVendors.OPEN_AI,
      models: [
        {
          name: "test-model",
          contextWindow: 100,
          features: [feature],
          priceSubscription: 20,
          pricePerTokenInput: 100,
          pricePerTokenOutput: 20,
        },
      ],
    });

    const repo = Repository.forModel(AIVendor);
    try {
      vendor = await repo.create(toCreate);
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
      vendor = await repo.read(AIVendors.OPEN_AI);
    }
    expect(vendor).toBeDefined();
    expect(vendor.hasErrors()).toBeUndefined();
    model = vendor.models[0];
  });

  it("Creates a prompt", async () => {
    const toCreate = new Prompt({
      reference: AIFeatures.CONTEXTUALIZATION,
      feature: feature,
      description: "contextualization prompt",
      vendors: [vendor],
      models: [model],
      role: {
        classification: PromptBlockType.ROLE,
        features: [feature],
        content: "role block",
        vendors: [vendor],
        models: [model],
      },
      task: {
        classification: PromptBlockType.TASK,
        features: [feature],
        content: "task block",
        vendors: [vendor],
        models: [model],
      },
      content: {
        classification: PromptBlockType.CONTENT,
        features: [feature],
        content: "content block",
        vendors: [vendor],
        models: [model],
      },
    });

    const repo = Repository.forModel(Prompt);
    try {
      prompt = await repo.create(toCreate);
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
      prompt = (
        await repo
          .select()
          .where(
            Condition.attr<Prompt>("reference").eq(AIFeatures.CONTEXTUALIZATION)
          )
          .execute()
      )[0];
    }
    expect(prompt).toBeDefined();
    expect(prompt.hasErrors()).toBeUndefined();
  });

  it("reads a prompt", async () => {
    const repo = Repository.forModel(Prompt);
    const read = await repo.read(prompt.id);
    expect(read).toBeDefined();
  });

  it("selects a prompt", async () => {
    const repo = Repository.forModel(Prompt);
    const read = await repo
      .select()
      .where(Condition.attr<Prompt>("id").eq(prompt.id))
      .execute();
    expect(read).toBeDefined();
    expect(read.length).toBe(1);
  });
});
