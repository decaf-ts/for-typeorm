import { Adapter, Repository, Repo } from "@decaf-ts/core";
import { TypeORMDispatch } from "../../src/TypeORMDispatch";
import { TypeORMFlavour } from "../../src/constants";
Adapter.setCurrent(TypeORMFlavour);
import { TypeORMAdapter } from "../../src/TypeORMAdapter";
TypeORMAdapter.decoration();
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { uses } from "@decaf-ts/decoration";
import { Observer } from "@decaf-ts/core";
import { Logging, LogLevel } from "@decaf-ts/logging";
import {
  TaskBuilder,
  TaskContext,
  TaskEngine,
  TaskEngineConfig,
  TaskEventBus,
  TaskEventModel,
  TaskEventType,
  TaskHandler,
  TaskHandlerRegistry,
  TaskLogger,
  TaskModel,
  TaskService,
  TaskStatus,
  task,
} from "@decaf-ts/core/tasks";
uses(TypeORMFlavour)(TaskModel);
uses(TypeORMFlavour)(TaskEventModel);
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

jest.setTimeout(200000);

const adminUser = process.env.TYPEORM_ADMIN_USER || "alfred";
const adminPassword = process.env.TYPEORM_ADMIN_PASSWORD || "password";
const adminDatabase = process.env.TYPEORM_ADMIN_DATABASE || "alfred";
const host = process.env.TYPEORM_HOST || "localhost";
const port = Number(process.env.TYPEORM_PORT || "5432");
const cleanupDelayMs = Number(process.env.TYPEORM_CLEANUP_DELAY_MS || "250");

const adminConfig: DataSourceOptions = {
  type: "postgres",
  username: adminUser,
  password: adminPassword,
  database: adminDatabase,
  host,
  port,
};

type TypeORMResources = {
  adapter: TypeORMAdapter;
  dbName: string;
  user: string;
  password: string;
};

function randomSuffix() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function waitForCleanup(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function createTypeORMTestResources(prefix: string) {
  const suffix = randomSuffix();
  const dbName = `${prefix}_${suffix}`;
  const user = `${prefix}_user_${suffix}`;
  const password = `${user}_pw`;

  const adminConnection = await TypeORMAdapter.connect(adminConfig);
  try {
    await TypeORMAdapter.createDatabase(adminConnection, dbName);
  } catch (e: any) {
    if (!(e instanceof ConflictError)) throw e;
  } finally {
    await adminConnection.destroy();
  }

  const adminDbConfig: DataSourceOptions = Object.assign({}, adminConfig, {
    database: dbName,
  });
  const adminDbConnection = await TypeORMAdapter.connect(adminDbConfig);
  try {
    await TypeORMAdapter.createUser(adminDbConnection, dbName, user, password);
    await TypeORMAdapter.createNotifyFunction(adminDbConnection, user);
  } finally {
    await adminDbConnection.destroy();
  }

  const adapterConfig: PostgresConnectionOptions = {
    type: "postgres",
    host,
    port,
    username: user,
    password,
    database: dbName,
    synchronize: true,
    logging: false,
  };
  const adapter = new TypeORMAdapter(adapterConfig);
  await adapter.initialize();

  return { adapter, dbName, user, password };
}

async function cleanupTypeORMTestResources(resources: TypeORMResources) {
  const adminConnection = await TypeORMAdapter.connect(adminConfig);
  try {
    await TypeORMAdapter.deleteDatabase(
      adminConnection,
      resources.dbName,
      resources.user
    );
  } catch (e: any) {
    if (!(e instanceof NotFoundError)) throw e;
  }
  await waitForCleanup(cleanupDelayMs);
  try {
    await TypeORMAdapter.deleteUser(adminConnection, resources.user, adminUser);
  } catch (e: any) {
    if (!(e instanceof NotFoundError)) throw e;
  } finally {
    await adminConnection.destroy();
  }
  await waitForCleanup(cleanupDelayMs);
}

const recordedEvents: TaskEventModel[] = [];

const parseNumberInput = (input: unknown): number => {
  if (typeof input === "number") return input;
  if (typeof input === "string") {
    const asNumber = Number(input);
    if (!Number.isNaN(asNumber)) return asNumber;
  }
  if (typeof input === "object" && input !== null) {
    const value = (input as { value?: unknown }).value;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const asNumber = Number(value);
      if (!Number.isNaN(asNumber)) return asNumber;
    }
  }
  throw new Error("invalid task input");
};

@task("typeorm-simple-task")
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class TypeORMSimpleTask extends TaskHandler<
  number | { value: number },
  number
> {
  async run(value: number | { value: number }, ctx: TaskContext) {
    const parsed = parseNumberInput(value);
    ctx.logger.info(`typeorm-simple-task ${parsed}`);
    await ctx.flush();
    return parsed * 3;
  }
}

@task("typeorm-progress-task")
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class TypeORMProgressTask extends TaskHandler<{ value: number }, number> {
  async run(input: { value: number }, ctx: TaskContext) {
    const parsed = parseNumberInput(input);
    ctx.logger.info("typeorm-progress-task: before step 1");
    await ctx.flush();
    await ctx.progress({
      status: TaskStatus.RUNNING,
      currentStep: 1,
      totalSteps: 2,
    });
    ctx.logger.info("typeorm-progress-task: before step 2");
    await ctx.flush();
    await ctx.progress({
      status: TaskStatus.RUNNING,
      currentStep: 2,
      totalSteps: 2,
    });
    ctx.logger.info("typeorm-progress-task: finished");
    await ctx.flush();
    return parsed + 7;
  }
}

describe.skip("TypeORM task engine integration", () => {
  let resources: TypeORMResources | undefined;
  let adapter: TypeORMAdapter;
  let taskService: TaskService<TypeORMAdapter>;
  let engine: TaskEngine<TypeORMAdapter>;
  let taskRepo: Repo<TaskModel>;
  let eventBus: TaskEventBus;
  let registry: TaskHandlerRegistry;
  let unsubscribe: (() => void) | undefined;

  beforeAll(async () => {
    resources = await createTypeORMTestResources("task_engine");
    adapter = resources.adapter;
    Repository.forModel(TaskModel, adapter.alias);

    eventBus = new TaskEventBus();
    registry = new TaskHandlerRegistry();

    const config: TaskEngineConfig<TypeORMAdapter> = {
      adapter,
      bus: eventBus,
      registry,
      workerId: "typeorm-integration-worker",
      concurrency: 1,
      leaseMs: 500,
      pollMsIdle: 1000,
      pollMsBusy: 200,
      logTailMax: 200,
      streamBufferSize: 5,
      maxLoggingBuffer: 100,
      loggingBufferTruncation: 10,
      gracefulShutdownMsTimeout: 4000,
    };

    taskService = new TaskService();
    await taskService.boot(config);
    engine = taskService.client as TaskEngine<TypeORMAdapter>;
    await engine.start();

    taskRepo = Repository.forModel(TaskModel, adapter.alias);

    const observer: Observer = {
      async refresh(evt: TaskEventModel) {
        if (evt?.taskId) {
          recordedEvents.push(evt);
        }
      },
    };
    unsubscribe = eventBus.observe(observer);
  });

  beforeEach(() => {
    recordedEvents.length = 0;
  });

  afterAll(async () => {
    unsubscribe?.();
    await taskService.shutdown();
    await adapter.shutdown();
    if (resources) {
      await cleanupTypeORMTestResources(resources);
    }
  });

  const eventsFor = (taskId: string, type?: TaskEventType) =>
    recordedEvents.filter(
      (evt) =>
        evt && evt.taskId === taskId && (!type || evt.classification === type)
    );

  it("executes a task and logs status events", async () => {
    const toSubmit = new TaskBuilder()
      .setClassification("typeorm-simple-task")
      .setInput({ value: 6 })
      .build();

    const { task, tracker } = await engine.push(toSubmit, true);
    const output = await tracker.resolve();

    expect(output).toBe(18);

    const persisted = await taskRepo.read(task.id);
    expect(persisted.status).toBe(TaskStatus.SUCCEEDED);
    expect(persisted.output).toBe(18);

    const statusEvents = eventsFor(task.id, TaskEventType.STATUS);
    const statusValues = statusEvents.map((evt) => evt.payload?.status);
    expect(statusValues).toEqual(
      expect.arrayContaining([TaskStatus.RUNNING, TaskStatus.SUCCEEDED])
    );
  });

  it("pipes status and progress events through the tracker", async () => {
    const capturedStatuses: TaskStatus[] = [];
    const progressPayloads: TaskEventModel[] = [];

    const composite = new TaskBuilder()
      .setClassification("typeorm-progress-task")
      .setInput({ value: 3 })
      .build();

    const { tracker } = await engine.push(composite, true);

    tracker.pipe((evt) => {
      const status = evt.payload?.status ?? evt.payload;
      if (typeof status === "string") {
        capturedStatuses.push(status as TaskStatus);
      }
    }, TaskEventType.STATUS);

    tracker.pipe((evt) => {
      progressPayloads.push(evt);
    }, TaskEventType.PROGRESS);

    const output = await tracker.resolve();
    expect(output).toBe(10);

    expect(capturedStatuses).toContain(TaskStatus.SUCCEEDED);
    expect(progressPayloads.length).toBeGreaterThanOrEqual(2);
    expect(progressPayloads[0].payload).toMatchObject({
      currentStep: 1,
      totalSteps: 2,
    });
  });

  it("records task events via the TaskEventModel repository", async () => {
    const eventRepo = Repository.forModel(TaskEventModel, adapter.alias);
    const composite = new TaskBuilder()
      .setClassification("typeorm-progress-task")
      .setInput({ value: 2 })
      .build();

    const { task, tracker } = await engine.push(composite, true);
    await tracker.resolve();

    const allEvents = await eventRepo.select().execute();
    const taskEvents = allEvents.filter((evt) => evt.taskId === task.id);

    expect(taskEvents.length).toBeGreaterThan(0);
    expect(
      taskEvents.some((evt) => evt.classification === TaskEventType.STATUS)
    ).toBe(true);
    expect(
      taskEvents.some((evt) => evt.classification === TaskEventType.LOG)
    ).toBe(true);

    const statusPayloads = taskEvents
      .filter((evt) => evt.classification === TaskEventType.STATUS)
      .map((evt) => evt.payload?.status);
    expect(statusPayloads).toContain(TaskStatus.SUCCEEDED);
  });

  it("attaches a custom logger and flushes raw logs", async () => {
    const baseLogger = Logging.get().for("typeorm-task-engine");
    const infoSpy = jest.spyOn(baseLogger, "info");
    const logger = new TaskLogger(baseLogger, 5, 10);
    const rawMessages: string[] = [];

    const toSubmit = new TaskBuilder()
      .setClassification("typeorm-progress-task")
      .setInput({ value: 1 })
      .build();

    const { tracker } = await engine.push(toSubmit, true);
    tracker.pipe((evt) => {
      if (evt.classification !== TaskEventType.LOG) return;
      const logs = evt.payload as Array<{
        level: LogLevel;
        msg: string;
        meta: unknown;
      }>;

      evt.payload = logs.map(({ level, msg, meta }) => [level, msg, meta]);
    });
    tracker.attach(logger, {
      logProgress: true,
      logStatus: true,
      style: false,
    });

    tracker.logs((logs) => {
      rawMessages.push(
        ...logs.map(
          (entry: [unknown, string | undefined, unknown]) => `${entry[1] ?? ""}`
        )
      );
    });

    try {
      await tracker.resolve();

      expect(
        rawMessages.some((msg) => msg.includes("typeorm-progress-task"))
      ).toBe(true);
      const infoCalls = infoSpy.mock.calls.map((call) => `${call[0] ?? ""}`);
      expect(infoCalls.some((call) => call.includes("### STATUS"))).toBe(true);
      expect(infoCalls.some((call) => call.includes("### STEP"))).toBe(true);
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("creates and tears down the TypeORM dispatch subscriber", async () => {
    const observer: Observer = {
      async refresh() {
        return;
      },
    };
    const unobserve = adapter.observe(observer);
    const dispatch = (adapter as any).dispatch as TypeORMDispatch;
    expect(dispatch).toBeInstanceOf(TypeORMDispatch);
    const subscriber = (dispatch as any).subscriber;
    expect(subscriber).toBeDefined();
    const dataSource = adapter.client;
    const dsSubscribers = (dataSource as any).subscribers as Array<any>;
    expect(dsSubscribers).toContain(subscriber);

    try {
      await dispatch.close();
      expect((dispatch as any).subscriber).toBeUndefined();
      expect(dsSubscribers).not.toContain(subscriber);
    } finally {
      unobserve();
    }
  });

  it("runs tasks through a proxied adapter", async () => {
    const proxied = adapter.for({ logging: true }) as TypeORMAdapter;
    await proxied.initialize();
    const proxiedBus = new TaskEventBus();
    const proxiedRegistry = new TaskHandlerRegistry();
    const config: TaskEngineConfig<TypeORMAdapter> = {
      adapter: proxied,
      bus: proxiedBus,
      registry: proxiedRegistry,
      workerId: "typeorm-proxied-worker",
      concurrency: 1,
      leaseMs: 500,
      pollMsIdle: 1000,
      pollMsBusy: 200,
      logTailMax: 200,
      streamBufferSize: 5,
      maxLoggingBuffer: 100,
      loggingBufferTruncation: 10,
      gracefulShutdownMsTimeout: 4000,
    };
    const proxiedService = new TaskService<TypeORMAdapter>();
    await proxiedService.boot(config);
    const proxiedEngine = proxiedService.client as TaskEngine<TypeORMAdapter>;
    await proxiedEngine.start();

    try {
      const toSubmit = new TaskBuilder()
        .setClassification("typeorm-simple-task")
        .setInput({ value: 4 })
        .build();

      const { tracker } = await proxiedEngine.push(toSubmit, true);
      const output = await tracker.resolve();
      expect(output).toBe(12);
    } finally {
      await proxiedService.shutdown().catch(() => undefined);
      await proxied.shutdown().catch(() => undefined);
    }
  });
});
