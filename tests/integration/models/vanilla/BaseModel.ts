import { CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Model, ModelArg, prop } from "@decaf-ts/decorator-validation";

export class BaseModel extends Model {
  @CreateDateColumn()
  @prop()
  createdOn!: Date;
  @UpdateDateColumn()
  @prop()
  updateOn!: Date;

  constructor(arg?: ModelArg<BaseModel>) {
    super(arg);
  }
}
