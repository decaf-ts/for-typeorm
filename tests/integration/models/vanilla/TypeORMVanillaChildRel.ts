import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { TypeORMVanillaRel } from "./TypeORMVanillaRel";
import { BaseModel } from "./BaseModel";

@Entity()
export class TypeORMVanillaChildRel extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @ManyToOne(() => TypeORMVanillaRel, (parent) => parent.child)
  parent!: TypeORMVanillaRel;
}
