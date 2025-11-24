import { DataSource } from "typeorm";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { TypeORMAdapter, TypeORMFlavour } from "../../src";
import {
  Cascade,
  column,
  createdBy,
  manyToMany,
  Observer,
  oneToOne,
  pk,
  Repository,
  table,
  updatedBy,
} from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { TypeORMRepository } from "../../src/TypeORMRepository";
import { model, ModelArg, required } from "@decaf-ts/decorator-validation";
import { TypeORMBaseModel } from "./baseModel";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

const admin = "alfred";
const admin_password = "password";
const user = "nested_ownership_user";
const user_password = "password";
const dbName = "nested_ownership_db";
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
@table("tst_owned_user")
@model()
class ChildOwnedModel extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column("tst_name")
  @required()
  name!: string;

  @column()
  @createdBy()
  createdBy!: string;

  @column()
  @updatedBy()
  updatedBy!: string;

  constructor(arg?: ModelArg<ChildOwnedModel>) {
    super(arg);
  }
}

@uses(TypeORMFlavour)
@table("tst_owned_other_user")
@model()
class OtherChildOwnedModel extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column("tst_name")
  @required()
  name!: string;

  @column()
  @createdBy()
  createdBy!: string;

  @column()
  @updatedBy()
  updatedBy!: string;

  constructor(arg?: ModelArg<OtherChildOwnedModel>) {
    super(arg);
  }
}

@uses(TypeORMFlavour)
@table("tst_owned_parent")
@model()
class ParentOwnedModel extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column("tst_name")
  @required()
  name!: string;

  @oneToOne(
    () => ChildOwnedModel,
    {
      update: Cascade.CASCADE,
      delete: Cascade.CASCADE,
    },
    true
  )
  @required()
  child!: ChildOwnedModel;

  @manyToMany(
    () => OtherChildOwnedModel,
    {
      update: Cascade.CASCADE,
      delete: Cascade.CASCADE,
    },
    true
  )
  children!: OtherChildOwnedModel[];

  @column()
  @createdBy()
  createdBy!: string;

  @column()
  @updatedBy()
  updatedBy!: string;

  constructor(arg?: ModelArg<ParentOwnedModel>) {
    super(arg);
  }
}

describe("Adapter with nested ownership", () => {
  let repo: TypeORMRepository<ParentOwnedModel>;

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
    repo = Repository.forModel(ParentOwnedModel);
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

  let created: ParentOwnedModel, updated: ParentOwnedModel;

  it("creates", async () => {
    const model = new ParentOwnedModel({
      name: "test_name",
      child: {
        name: "child_name",
      },
      children: [
        {
          name: "child_name_list_0",
        },
        {
          name: "child_name_list_1",
        },
      ],
    });

    created = await repo.create(model);

    expect(created).toBeDefined();
    expect(created.hasErrors()).toBeUndefined();
    // await new Promise((resolve) => setTimeout(resolve, 10000));
    // expect(mock).toHaveBeenCalledWith(
    //   Model.tableName(TestModel),
    //   OperationKeys.CREATE,
    //   [model.id]
    // );
  });

  it("reads", async () => {
    const read = await repo.read(created.id as number);

    expect(read).toBeDefined();
    expect(read.equals(created)).toEqual(true); // same model
    expect(read === created).toEqual(false); // different instances
  });

  it("updates", async () => {
    const toUpdate = new ParentOwnedModel(
      Object.assign({}, created, {
        name: "new_test_name",
      })
    );

    updated = await repo.update(toUpdate);

    expect(updated).toBeDefined();
    expect(updated.equals(created)).toEqual(false);
    expect(updated.equals(created, "updatedAt", "name", "version")).toEqual(
      true
    ); // minus the expected changes
  });

  it("deletes", async () => {
    const deleted = await repo.delete(created.id as number);
    expect(deleted).toBeDefined();
    expect(deleted.equals(updated)).toEqual(true);

    await expect(repo.read(created.id as number)).rejects.toThrowError(
      NotFoundError
    );
  });
});
