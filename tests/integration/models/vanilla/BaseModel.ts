import { CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Model, ModelArg } from "@decaf-ts/decorator-validation";
import { prop } from "@decaf-ts/decoration";

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
