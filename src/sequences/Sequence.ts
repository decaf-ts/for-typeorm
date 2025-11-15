import { InternalError, NotFoundError } from "@decaf-ts/db-decorators";
import { SequenceOptions } from "@decaf-ts/core";
import { Sequence } from "@decaf-ts/core";
import { TypeORMAdapter } from "../TypeORMAdapter";

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
    protected adapter: TypeORMAdapter
  ) {
    super(options);
  }

  /**
   * @summary Retrieves the current value for the sequence
   * @protected
   */
  async current(): Promise<string | number | bigint> {
    const { name } = this.options;
    try {
      const rows: any[] = await this.adapter.raw({
        query: `SELECT sequence_name, start_value, minimum_value, increment FROM information_schema.sequences WHERE sequence_name = $1`,
        values: [name],
      });
      if (!Array.isArray(rows) || rows.length === 0)
        throw new NotFoundError(`Sequence ${name} not found`);
      // information_schema does not expose the current runtime value reliably; fall back to start_value
      const row = rows[0] as Record<string, any>;
      const candidate =
        row["current_value"] ?? row["last_value"] ?? row["start_value"];
      return this.parse(candidate as string | number);
    } catch (e: unknown) {
      throw this.adapter.parseError(e as Error);
    }
  }

  /**
   * @summary Parses the {@link Sequence} value
   *
   * @protected
   * @param value
   */
  private parse(value: string | number | bigint): string | number | bigint {
    return Sequence.parseValue(this.options.type, value);
  }

  /**
   * @summary increments the sequence
   * @description Sequence specific implementation
   *
   * @param {string | number | bigint} current
   * @param count
   * @protected
   */
  private async increment(
    current: string | number | bigint,
    count?: number
  ): Promise<string | number | bigint> {
    const { type, incrementBy, name, startWith } = this.options;
    if (type !== "Number" && type !== "BigInt")
      throw new InternalError(
        `Cannot increment sequence of type ${type} with ${count}`
      );

    try {
      const rows: any[] = await this.adapter.raw({
        query: `SELECT nextval($1) AS nextval;`,
        values: [name],
      });
      const val = Array.isArray(rows) && rows[0] ? rows[0]["nextval"] : rows;
      return val as string | number | bigint;
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
      if (!name)
        throw new InternalError(
          `Cannot increment sequence without a name: ${name}`
        );
      // Create the sequence if missing. Identifiers cannot be parameterized, so quote the name.
      const quoted = `"${name.replace(/"/g, '""')}"`;
      await this.adapter.raw({
        query: `CREATE SEQUENCE IF NOT EXISTS ${quoted} START WITH ${startWith} INCREMENT BY ${incrementBy} NO CYCLE;`,
        values: [],
      });
      const rows: any[] = await this.adapter.raw({
        query: `SELECT nextval($1) AS nextval;`,
        values: [name],
      });
      const val = Array.isArray(rows) && rows[0] ? rows[0]["nextval"] : rows;
      return val as string | number | bigint;
    }
  }

  /**
   * @summary Generates the next value in th sequence
   * @description calls {@link Sequence#parse} on the current value
   * followed by {@link Sequence#increment}
   *
   */
  async next(): Promise<number | string | bigint> {
    const current = await this.current();
    return this.increment(current);
  }

  async range(count: number): Promise<(number | string | bigint)[]> {
    const current = (await this.current()) as number;
    const incrementBy = this.parse(this.options.incrementBy) as number;
    const next: string | number | bigint = await this.increment(
      current,
      (this.parse(count) as number) * incrementBy
    );
    const range: (number | string | bigint)[] = [];
    for (let i: number = 1; i <= count; i++) {
      range.push(current + incrementBy * (this.parse(i) as number));
    }
    if (range[range.length - 1] !== next)
      throw new InternalError("Miscalculation of range");
    return range;
  }
}
