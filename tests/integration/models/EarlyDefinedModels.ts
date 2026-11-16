/**
 * Models defined BEFORE `@decaf-ts/for-typeorm` is loaded — like the core
 * TaskEngine models, which `@decaf-ts/core` defines on import. They carry
 * the default-flavour decorators until `uses(TypeORMFlavour)` re-flavours
 * them. This module must only import core/decoration/validation packages.
 */
import { column, pk, table, uuid } from "@decaf-ts/core";
import { Model, model, required, type ModelArg } from "@decaf-ts/decorator-validation";

/** `@pk()` filled by decaf (`@uuid()`), not by the database. */
@table("pkgen_early_uuid")
@model()
export class EarlyUuidModel extends Model {
  @pk()
  @uuid()
  id!: string;

  @column()
  @required()
  name!: string;

  constructor(arg?: ModelArg<EarlyUuidModel>) {
    super(arg);
  }
}

/** A caller-supplied string key. */
@table("pkgen_early_manual")
@model()
export class EarlyManualModel extends Model {
  @pk({ type: String, generated: false })
  id!: string;

  @column()
  @required()
  name!: string;

  constructor(arg?: ModelArg<EarlyManualModel>) {
    super(arg);
  }
}
