import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMAdapter, TypeORMFlavour } from "../../src";
import { TypeORMBaseModel } from "./baseModel";
import {
  Model,
  model,
  ModelArg,
  ModelKeys,
  required,
} from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import {
  Cascade,
  column,
  Observer,
  oneToOne,
  pk,
  Repository,
  table,
  uses,
} from "@decaf-ts/core";

const admin = "alfred";
const admin_password = "password";
const user = "cross_relations_user";
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

const dbName = "cross_relations__db";

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

@uses(TypeORMFlavour)
@table("tst_cross_relation")
@model()
class TestRelationCrossRelation extends TypeORMBaseModel {
  @column("tst_cross_id")
  @pk({ type: "Number" })
  id!: number;

  @column("tst_section_text")
  @required()
  content!: string;

  constructor(arg?: ModelArg<TestRelationCrossRelation>) {
    super(arg);
  }
}

@uses(TypeORMFlavour)
@table("tst_cross")
@model()
class TestOneToOneCross extends TypeORMBaseModel {
  @column("tst_cross_id")
  @pk({ type: "Number" })
  id!: number;

  @required()
  @oneToOne(
    TestRelationCrossRelation,
    {
      update: Cascade.CASCADE,
      delete: Cascade.CASCADE,
    },
    true
  )
  child!: TestRelationCrossRelation;

  constructor(arg?: ModelArg<TestOneToOneCross>) {
    super(arg);
  }
}

@uses(TypeORMFlavour)
@table("tst_cross_id")
@model()
class TestOneToOneCross2 extends TypeORMBaseModel {
  @column("tst_cross_id")
  @pk({ type: "Number" })
  id!: number;

  @oneToOne(
    TestRelationCrossRelation,
    {
      update: Cascade.CASCADE,
      delete: Cascade.CASCADE,
    },
    true
  )
  @required()
  child!: TestRelationCrossRelation;

  constructor(arg?: ModelArg<TestOneToOneCross>) {
    super(arg);
  }
}

describe(`cross decoration relations`, function () {
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
          TestRelationCrossRelation[ModelKeys.ANCHOR],
          TestOneToOneCross[ModelKeys.ANCHOR],
          TestOneToOneCross2[ModelKeys.ANCHOR],
        ],
      }) as DataSourceOptions
    );
    await dataSource.initialize();
    adapter["_dataSource"] = dataSource;
  });

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

  let child: TestRelationCrossRelation | undefined;

  it("creates oneToOne no relation", async () => {
    const repo = Repository.forModel(TestRelationCrossRelation);
    child = await repo.create(
      new TestRelationCrossRelation({
        content: "test_text",
      })
    );
    expect(child).toBeDefined();
    expect(child.hasErrors()).toBeUndefined();
  });

  it("creates oneToOne with existing", async () => {
    const repo = Repository.forModel(TestOneToOneCross);
    const created = await repo.create(
      new TestOneToOneCross({
        child: child,
      })
    );
    expect(created).toBeDefined();
    expect(created.hasErrors()).toBeUndefined();
  });
  it("creates oneToOne with new", async () => {
    const repo = Repository.forModel(TestOneToOneCross);
    const toCreate = new TestOneToOneCross({
      child: {
        content: "test_text",
      },
    });
    const created = await repo.create(toCreate);
    expect(created).toBeDefined();
    expect(created.hasErrors()).toBeUndefined();
  });

  it("creates oneToOne with new - inverse decorator order", async () => {
    const repo = Repository.forModel(TestOneToOneCross2);
    const toCreate = new TestOneToOneCross2({
      child: {
        content: "test_text",
      },
    });
    const created = await repo.create(toCreate);
    expect(created).toBeDefined();
    expect(created.hasErrors()).toBeUndefined();
  });
});
