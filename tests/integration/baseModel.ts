import { column, createdAt, updatedAt } from "@decaf-ts/core";
import { Model, ModelArg } from "@decaf-ts/decorator-validation";
import { version } from "@decaf-ts/db-decorators";

export class TypeORMBaseModel extends Model {
  @column("created_on")
  @createdAt()
  createdAt!: Date;

  @column("updated_on")
  @updatedAt()
  updatedAt!: Date;

  // @column("created_by")
  // @createdBy()
  // createdBy!: string;

  // @column()
  // @updatedBy()
  // updatedBy!: string;

  @version()
  version!: number;

  constructor(arg?: ModelArg<TypeORMBaseModel>) {
    super(arg);
  }
}
