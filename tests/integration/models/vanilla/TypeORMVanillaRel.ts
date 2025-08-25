import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { TypeORMVanillaChildRel } from "./TypeORMVanillaChildRel";
import { BaseModel } from "./BaseModel";

@Entity()
export class TypeORMVanillaRel extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @OneToMany(() => TypeORMVanillaChildRel, (child) => child.parent, {
    cascade: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
    eager: true,
  })
  child!: TypeORMVanillaChildRel[];
}
