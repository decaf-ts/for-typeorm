import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMAdapter } from "../../src";
import { Model, ModelKeys } from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { Observer, Repository } from "@decaf-ts/core";
import { PromptBlock } from "./models/PromptBlock";
import { Prompt } from "./models/Prompt";
import { AIFeatures, AIVendors, PromptBlockType } from "./models/contants";
import { AIFeature } from "./models/AIFeature";

const admin = "alfred";
const admin_password = "password";
const user = "prompt_relations_user";
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

const dbName = "prompt_relations__db";

Model.setBuilder(Model.fromModel);

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

describe(`prompt decoration relations`, function () {
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
          PromptBlock[ModelKeys.ANCHOR],
          Prompt[ModelKeys.ANCHOR],
          AIFeature[ModelKeys.ANCHOR],
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

  it("Creates an AIFeature", async () => {
    const repo = Repository.forModel(AIFeature);
    feature = await repo.create(
      new AIFeature({
        name: AIFeatures.CONTEXTUALIZATION,
        description:
          "Shorten one or more documents into a concise version that keeps the main points and meaning",
      })
    );

    expect(feature).toBeDefined();
    expect(feature.hasErrors()).toBeUndefined();
  });

  it("creates a prompt", async () => {
    const contextualizationContentPrompts = [
      {
        block: `\n- CHUNK: <<<chunk starts>>>
{0}
<<<chunk ends>>>`,
        vendor: AIVendors.OPEN_AI,
        model: "gpt-4.1",
      },
    ].map(({ block, vendor, model }) => {
      return new PromptBlock({
        classification: PromptBlockType.CONTENT,
        features: [feature],
        content: block,
        vendor: vendor,
        model: model,
      });
    });

    const contextualizationContextPrompts = [
      {
        block: `(one or more blocks; earlier blocks are higher priority):
  {0}
  - GLOSSARY 
  {1}`,
        vendor: AIVendors.OPEN_AI,
        model: "gpt-4.1",
      },
    ].map(({ block, vendor, model }) => {
      return new PromptBlock({
        classification: PromptBlockType.CONTEXT,
        features: [feature],
        content: block,
        vendor: vendor,
        model: model,
      });
    });

    const contextualizationFormatPrompts = [
      {
        block: `Return a single JSON object with:
{
  "text": "<the fully rewritten, contextualized text>",
  "first_occurrence_expansions": [
    {"acronym": "SRE", "expanded_to": "SRE (Site Reliability Engineering)"},
    {"acronym": "ASAP", "expanded_to": "ASAP (as soon as possible)"}
  ],
  "replacements_log": [
    {"from": "he", "to": "Alex Silva", "evidence": "[C1] org chart, sentence 2"},
    {"from": "her", "to": "Maria Pereira", "evidence": "[C1] meeting attendees"}
  ],
  "ambiguous": [
    {"pronoun": "it", "note": "Unclear whether 'it' refers to the API or the database", "spans": [42, 44]}
  ]
}
Only output valid JSON—no extra commentary.`,
        vendor: AIVendors.OPEN_AI,
        model: "gpt-4.1",
      },
    ].map(({ block, vendor, model }) => {
      return new PromptBlock({
        classification: PromptBlockType.FORMAT,
        features: [feature],
        content: block,
        vendor: vendor,
        model: model,
      });
    });
    const contextualizationRequirementsPrompts = [
      {
        block: `- Use CONTEXT to resolve references (people, teams, products, artifacts, dates, places, “it/this/that/they/these/those”).
- Prefer full names on first mention; later mentions may use the shortest unambiguous form (e.g., surname or team).
- Keep quotes and technical terms intact; do not paraphrase code or error messages.
- Preserve numbering, bulleting, and formatting where possible.
- Do not add, remove, or reorder content beyond what’s needed for clarity and the required replacements/expansions.`,
        vendor: AIVendors.OPEN_AI,
        model: "gpt-4.1",
      },
    ].map(({ block, vendor, model }) => {
      return new PromptBlock({
        classification: PromptBlockType.REQUIREMENTS,
        features: [feature],
        content: block,
        vendor: vendor,
        model: model,
      });
    });

    const contextualizationRolePrompts: PromptBlock[] = [
      {
        block: `You are a careful editor. Rewrite the CHUNK using the provided CONTEXT blocks and optional GLOSSARY to make it fully self-contained and clear.`,
        vendor: AIVendors.OPEN_AI,
        model: "gpt-4.1",
      },
    ].map(({ block, vendor, model }) => {
      return new PromptBlock({
        classification: PromptBlockType.ROLE,
        features: [feature],
        content: block,
        vendor: vendor,
        model: model,
      });
    });

    const contextualizationTaskPrompts = [
      {
        block: `1) Contextualize the CHUNK by resolving references using CONTEXT.
2) Replace pronouns with their specific named referents when deterministically available.
   - Scope (choose one): {PRONOUN_SCOPE=all | third-person-only}. Default: all.
   - Preserve meaning, tense, and tone. Do not invent facts.
   - If a pronoun’s referent is not clear from CONTEXT, leave the pronoun as-is and add a footnote noting the ambiguity.
3) Expand acronyms at their first occurrence in the rewritten text using GLOSSARY.
   - Format: {ACRONYM_STYLE="ABC (definition)"} (default) or {"Full Term (ABC)"} if a full term is available.
   - Only expand once per acronym; leave subsequent mentions unchanged.
   - If an acronym isn’t in GLOSSARY, do not guess; leave it as-is.`,
        vendor: AIVendors.OPEN_AI,
        model: "gpt-4.1",
      },
    ].map(({ block, vendor, model }) => {
      return new PromptBlock({
        classification: PromptBlockType.TASK,
        features: [feature],
        content: block,
        vendor: vendor,
        model: model,
      });
    });
    const ContextualizationPrompts = [
      {
        role: contextualizationRolePrompts[0],
        persona: undefined,
        task: contextualizationTaskPrompts[0],
        planning: undefined,
        persistence: undefined,
        requirements: contextualizationRequirementsPrompts[0],
        content: contextualizationContentPrompts[0],
        context: contextualizationContextPrompts[0],
        tools: undefined,
        format: contextualizationFormatPrompts[0],
        examples: undefined,
        footnote: undefined,

        description: "General contextualization Prompt",
        reference: AIFeatures.CONTEXTUALIZATION,
      },
    ].map(
      (p) =>
        new Prompt(
          Object.assign(p, {
            feature: feature,
          })
        )
    );

    const repo = Repository.forModel(Prompt);
    const p = ContextualizationPrompts[0];
    const prompt = await repo.create(p);
    expect(prompt).toBeDefined();
    expect(prompt.hasErrors()).toBeUndefined();
  });
});
