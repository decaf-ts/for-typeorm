import { InternalError, NotFoundError } from "@decaf-ts/db-decorators";
import { SequenceOptions } from "@decaf-ts/core";
import { Sequence } from "@decaf-ts/core";
import { TypeORMAdapter } from "../TypeORMAdapter";

/**
 * @summary Abstract implementation of a Sequence
 * @description provides the basic functionality for {@link Sequence}s
 *
 * @param {SequenceOptions} options
 *
 * @class TypeORMSequence
 * @implements Sequence
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
      const seq: any = await this.adapter.raw(
        {
          query: `SELECT current_value FROM information_schema.sequences WHERE sequence_name = $1`,
          values: [name],
        },
        true
      );
      return this.parse(seq.current_value as string | number);
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
    let next: string | number | bigint;
    try {
      next = await this.adapter.raw(
        {
          query: `SELECT nextval($1);`,
          values: [name],
        },
        true
      );
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
      next = await this.adapter.raw(
        {
          query: `CREATE SEQUENCE IF NOT EXISTS $1 START WITH $2 INCREMENT BY $3 NO CYCLE;`,
          values: [name, startWith, incrementBy],
        },
        true
      );
    }

    return next as string | number | bigint;
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
