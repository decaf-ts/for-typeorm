import {
  InternalError,
  NotFoundError,
  OperationKeys,
} from "@decaf-ts/db-decorators";
import {
  Adapter,
  Context,
  MaybeContextualArg,
  SequenceOptions,
} from "@decaf-ts/core";
import { Sequence } from "@decaf-ts/core";
import { TypeORMContext } from "../TypeORMAdapter";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { DataSource } from "typeorm";
import { TypeORMQuery } from "../types";

/**
 * @description Abstract implementation of a database sequence for TypeORM.
 * @summary Provides the basic functionality for {@link Sequence}s, delegating to the {@link TypeORMAdapter} to fetch and increment values while handling type parsing and error translation.
 * @param {SequenceOptions} options The sequence configuration options (name, type, startWith, incrementBy, etc.).
 * @param {TypeORMAdapter} adapter The TypeORM adapter used to execute sequence operations.
 * @class TypeORMSequence
 * @implements Sequence
 * @example
 * // Create and use a TypeORM-backed sequence
 * const seq = new TypeORMSequence({ name: "user_id_seq", type: "Number", startWith: 1, incrementBy: 1 }, adapter);
 * const nextId = await seq.next();
 *
 * @mermaid
 * sequenceDiagram
 *   participant App
 *   participant Seq as TypeORMSequence
 *   participant Adapter as TypeORMAdapter
 *   participant DB as Database
 *   App->>Seq: next()
 *   Seq->>Seq: current()
 *   Seq->>Adapter: raw(SELECT current_value ...)
 *   Adapter->>DB: Query current value
 *   DB-->>Adapter: current_value
 *   Adapter-->>Seq: value
 *   Seq->>Seq: increment(current)
 *   Seq->>Adapter: raw(nextval(name))
 *   Adapter->>DB: nextval()
 *   DB-->>Adapter: next value
 *   Adapter-->>Seq: value
 *   Seq-->>App: parsed next value
 */
export class TypeORMSequence extends Sequence {
  constructor(
    options: SequenceOptions,
    adapter: Adapter<
      DataSourceOptions,
      DataSource,
      TypeORMQuery,
      TypeORMContext
    >
  ) {
    super(options, adapter);
  }

  /**
   * @summary Retrieves the current value for the sequence
   * @protected
   */
  override async current(
    ...args: MaybeContextualArg<any>
  ): Promise<string | number | bigint> {
    const { ctx } = (await this.logCtx(args, OperationKeys.READ, true)).for(
      this.current
    );
    const { name, startWith } = this.options;
    try {
      if (!name)
        throw new InternalError(`Sequence name is required to read current`);
      const quoted = `"${name.replace(/"/g, '""')}"`;
      const rows: any[] = await this.adapter.raw(
        {
          query: `SELECT last_value, is_called FROM ${quoted};`,
          values: [],
        },
        true,
        ctx
      );
      if (!Array.isArray(rows) || rows.length === 0)
        throw new InternalError(`Failed to read current value for ${name}`);
      const row = rows[0] as Record<string, any>;
      return this.parse(row["last_value"] as string | number);
    } catch (e: unknown) {
      if (e instanceof NotFoundError) {
        if (typeof startWith === "undefined")
          throw new InternalError(
            `Starting value is not defined for a non existing sequence`
          );
        return this.parse(startWith);
      }
      throw this.adapter.parseError(e as Error);
    }
  }

  /**
   * @summary increments the sequence
   * @description Sequence specific implementation
   *
   * @param {string | number | bigint} current
   * @param count
   * @protected
   */
  protected override async increment(
    count: number | undefined,
    ctx: Context<any>
  ): Promise<string | number | bigint> {
    const { type, incrementBy, name, startWith, minValue, maxValue, cycle } =
      this.options;
    const typeName =
      typeof type === "function" && (type as any)?.name ? (type as any).name : type;
    if (typeName !== Number.name && typeName !== BigInt.name)
      throw new InternalError(
        `Cannot increment sequence of type ${type} with ${count}`
      );
    if (!name)
      throw new InternalError(`Cannot increment sequence without a name: ${name}`);

    try {
      const toIncrementBy = count ?? incrementBy;
      if (toIncrementBy % incrementBy !== 0)
        throw new InternalError(
          `Value to increment does not consider the incrementBy setting: ${incrementBy}`
        );
      const current = await this.current(ctx);
      const next =
        typeName === BigInt.name
          ? (this.parse(current) as bigint) + BigInt(toIncrementBy)
          : (this.parse(current) as number) + toIncrementBy;
      await this.adapter.raw(
        {
          query: `SELECT setval($1::regclass, $2, true) AS nextval;`,
          values: [name, next],
        },
        true,
        ctx
      );
      return next as string | number | bigint;
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
      // Create the sequence if missing. Identifiers cannot be parameterized, so quote the name.
      const quoted = `"${name.replace(/"/g, '""')}"`;
      const startValue =
        typeof startWith === "number" ? startWith : incrementBy;
      const minValueClause =
        typeof minValue === "number"
          ? ` MINVALUE ${minValue}`
          : typeof startWith === "number" && startWith < 1
            ? ` MINVALUE ${startWith}`
            : "";
      const maxValueClause =
        typeof maxValue === "number" ? ` MAXVALUE ${maxValue}` : "";
      const cycleClause = cycle ? " CYCLE" : " NO CYCLE";
      await this.adapter.raw(
        {
          query: `CREATE SEQUENCE IF NOT EXISTS ${quoted} START WITH ${startValue} INCREMENT BY ${incrementBy}${minValueClause}${maxValueClause}${cycleClause};`,
          values: [],
        },
        true,
        ctx
      );
      const toIncrementBy = count ?? incrementBy;
      if (toIncrementBy % incrementBy !== 0)
        throw new InternalError(
          `Value to increment does not consider the incrementBy setting: ${incrementBy}`
        );
      const current =
        typeof startWith === "number" ? startWith : this.parse(startWith);
      const next =
        typeName === BigInt.name
          ? (this.parse(current) as bigint) + BigInt(toIncrementBy)
          : (this.parse(current) as number) + toIncrementBy;
      await this.adapter.raw(
        {
          query: `SELECT setval($1::regclass, $2, true) AS nextval;`,
          values: [name, next],
        },
        true,
        ctx
      );
      return next as string | number | bigint;
    }
  }

  /**
   * @summary Generates the next value in th sequence
   * @description calls {@link Sequence#parse} on the current value
   * followed by {@link Sequence#increment}
   *
   */
  override async next(
    ...argz: MaybeContextualArg<any>
  ): Promise<number | string | bigint> {
    const { ctx } = (await this.logCtx(argz, OperationKeys.UPDATE, true)).for(
      this.next
    );
    return this.increment(undefined, ctx);
  }

  override async range(
    count: number,
    ...argz: MaybeContextualArg<any>
  ): Promise<(number | string | bigint)[]> {
    const { ctx } = (await this.logCtx(argz, OperationKeys.UPDATE, true)).for(
      this.range
    );
    const current = (await this.current(ctx)) as number;
    const incrementBy = this.parse(this.options.incrementBy) as number;
    const next: string | number | bigint = await this.increment(
      (this.parse(count) as number) * incrementBy,
      ctx
    );
    const range: (number | string | bigint)[] = [];
    for (let i: number = 1; i <= count; i++) {
      range.push(current + incrementBy * (this.parse(i) as number));
    }
    if (range[range.length - 1] !== next)
      throw new InternalError("Miscalculation of range");
    return range;
  }

  /**
   * @summary Ensures the backing Postgres sequence exists and is at least a given value.
   * @description This is required for @sequence() / @version(true) behaviours that seed sequences
   * from an already-present model value (allowGenerationOverride) without relying on SequenceModel.
   */
  override async ensureAtLeast(
    value: string | number | bigint,
    ...argz: MaybeContextualArg<any>
  ): Promise<string | number | bigint> {
    const { ctx } = (await this.logCtx(argz, OperationKeys.UPDATE, true)).for(
      this.ensureAtLeast
    );
    const { name, type, incrementBy, startWith, minValue, maxValue, cycle } =
      this.options;
    if (!name) throw new InternalError("Sequence name is required");
    const typeName =
      typeof type === "function" && (type as any)?.name ? (type as any).name : type;
    if (typeName !== Number.name && typeName !== BigInt.name) {
      throw new InternalError(
        `Cannot ensure sequence of type ${type} is at least ${value}`
      );
    }

    const desired = this.parse(value) as number | bigint;

    const quoted = `"${name.replace(/"/g, '""')}"`;
    const minValueClause =
      typeof minValue === "number"
        ? ` MINVALUE ${minValue}`
        : typeof startWith === "number" && startWith < 1
          ? ` MINVALUE ${startWith}`
          : "";
    const maxValueClause = typeof maxValue === "number" ? ` MAXVALUE ${maxValue}` : "";
    const cycleClause = cycle ? " CYCLE" : " NO CYCLE";
    const createSeq = async () => {
      const startValue =
        typeof startWith === "number"
          ? startWith
          : typeof incrementBy === "number"
            ? incrementBy
            : 1;
      await this.adapter.raw(
        {
          query: `CREATE SEQUENCE IF NOT EXISTS ${quoted} START WITH ${startValue} INCREMENT BY ${incrementBy}${minValueClause}${maxValueClause}${cycleClause};`,
          values: [],
        },
        true,
        ctx
      );
    };

    const exists = async (): Promise<boolean> => {
      const rows: any[] = await this.adapter.raw(
        {
          query: `SELECT to_regclass($1) AS reg;`,
          values: [name],
        },
        true,
        ctx
      );
      const reg = rows?.[0]?.["reg"];
      return !!reg;
    };

    const readCurrent = async (): Promise<number | bigint> => {
      const rows: any[] = await this.adapter.raw(
        {
          query: `SELECT last_value FROM ${quoted};`,
          values: [],
        },
        true,
        ctx
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new InternalError(`Failed to read current value for ${name}`);
      }
      return this.parse(rows[0]["last_value"]) as any;
    };

    const greaterThan = (a: number | bigint, b: number | bigint) => {
      if (typeof a === "bigint" || typeof b === "bigint") {
        return BigInt(a as any) > BigInt(b as any);
      }
      return Number(a) > Number(b);
    };

    // Always create the sequence when missing, then seed/advance it if required.
    if (!(await exists())) {
      await createSeq();
      await this.adapter.raw(
        {
          query: `SELECT setval($1::regclass, $2, true) AS nextval;`,
          values: [name, desired],
        },
        true,
        ctx
      );
      return desired;
    }

    const current = await readCurrent();
    if (!greaterThan(desired, current)) return current;

    await this.adapter.raw(
      {
        query: `SELECT setval($1::regclass, $2, true) AS nextval;`,
        values: [name, desired],
      },
      true,
      ctx
    );
    return desired;
  }
}
