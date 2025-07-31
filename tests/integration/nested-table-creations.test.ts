import { TypeORMAdapter } from "../../src";
import { DataSource, DataSourceOptions } from "typeorm";

const admin = "alfred";
const admin_password = "password";
const dbHost = "localhost";
const dbName = "table_creation_db";

const config: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
};
let con: DataSource = new DataSource(config);
const adapter = new TypeORMAdapter(con);

import { Logging, LogLevel } from "@decaf-ts/logging";
import {
  list,
  min,
  minlength,
  model,
  Model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";
import { column, oneToMany, oneToOne, pk, table } from "@decaf-ts/core";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";

Logging.setConfig({ level: LogLevel.debug });

jest.setTimeout(50000);
export enum AIFeatures {
  SUMMARIZATION = "summarization",
  CONTEXTUALIZATION = "contextualization",
  KEYWORDS = "keywords",
  RERANKING = "reraking",
  TEXT_TO_SPEECH = "text-to-speech",
  SPEECH_TO_TEXT = "speech-to-text",
  IMAGE_TO_TEXT = "image-to-text",
  TEXT_TO_VIDEO = "text-to-video",
  VISION_TO_TEXT = "vision-to-text",
  OBJECT_RECOGNITION = "object-recognition",
  REASONING = "reasoning",
  QUESTION_ANSWERING = "question-answering",
  CHAT = "chat",
  TRANSLATION = "translation",
  PLANNING = "planning",
  RESEARCH = "research",
  DEEP_RESEARCH = "deep-research",
}

export enum AIVendors {
  GOOGLE = "google",
  OPEN_AI = "openai",
  ANTHROPIC = "anthropic",
  PERPLEXITY = "perplexity",
  MIDJOURNEY = "midjourney",
  RUNWAY = "runway",
  OLLAMA = "ollama",
}

describe("nested table creations", () => {
  @table("ai_features")
  @model()
  class AIFeature extends Model {
    @pk()
    name!: AIFeatures;

    @required()
    description!: string;

    constructor(arg?: ModelArg<AIFeature>) {
      super(arg);
    }
  }

  @table("ai_models_simple")
  @model()
  class AIModelSimple extends Model {
    @pk()
    name!: string;

    @oneToOne(AIFeature)
    @required()
    features!: AIFeature;

    constructor(arg?: ModelArg<AIModelSimple>) {
      super(arg);
    }
  }

  @table("ai_models_less_simple")
  @model()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class AIModelLessSimple extends Model {
    @pk()
    name!: string;

    // @manyToMany(AIFeature)
    @required()
    features!: AIFeature[];

    constructor(arg?: ModelArg<AIModelSimple>) {
      super(arg);
    }
  }

  @table("ai_models")
  @model()
  class AIModel extends Model {
    /**
     * @description Unique identifier for the AI model
     * @summary The model's unique identifier string
     */
    @pk()
    name!: string;

    /**
     * @description Maximum context window size in tokens
     * @summary The number of tokens the model can process in a single context window
     */
    @column("context_window")
    @required()
    @min(1)
    contextWindow!: number;

    /**
     * @description List of features supported by this AI model
     * @summary Collection of AI features that this model supports
     */
    @oneToMany(AIFeature)
    // @list([AIFeature, String])
    @minlength(1)
    @required()
    features!: AIFeatures[];

    @column("price_subscription")
    @required()
    priceSubscription!: number;

    @column("price_per_token_input")
    @required()
    pricePerTokenInput!: number;

    @column("price_per_token_output")
    @required()
    pricePerTokenOutput!: number;

    constructor(arg?: ModelArg<AIModel>) {
      super(arg);
    }
  }

  @table("ai_vendors")
  @model()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class AIVendor extends Model {
    @pk()
    name!: AIVendors;
    /**
     * @description Collection of AI models offered by this provider
     * @summary List of AI models that this provider makes available
     */
    @minlength(1)
    @list(AIModel)
    @oneToMany(AIModel)
    models!: AIModel[];

    @required()
    @min(1)
    subscriptionPrice!: number;

    constructor(arg?: ModelArg<AIVendor>) {
      super(arg);
    }
  }

  beforeAll(async () => {
    con = await TypeORMAdapter.connect(config);
    expect(con).toBeDefined();

    try {
      await TypeORMAdapter.deleteDatabase(con, dbName);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) {
        throw e;
      }
    }

    try {
      await TypeORMAdapter.createDatabase(con, dbName);
      await con.destroy();
      con = await TypeORMAdapter.connect(
        Object.assign({}, config, {
          database: dbName,
        })
      );
      await TypeORMAdapter.createNotifyFunction(con, admin);
      await con.destroy();
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }

    con = await TypeORMAdapter.connect(
      Object.assign({}, config, {
        user: admin,
        password: admin_password,
        database: dbName,
      })
    );

    adapter["_native" as keyof typeof TypeORMAdapter] = con;
  });

  afterAll(async () => {
    await con.destroy();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName);
    await con.destroy();
  });

  it("creates from nested models", async () => {
    try {
      await TypeORMAdapter.createTable(adapter.native, AIModelSimple);
    } catch (e: unknown) {
      console.log(e);
      throw e;
    }
  });

  // for (const m of [AIFeature, AIModel] as Constructor<Model>[]) {
  //   it(`creates ${Repository.table(m)} table from model`, async () => {
  //     await TypeORMAdapter.createTable(adapter.native, m);
  //   });
  // }
});
