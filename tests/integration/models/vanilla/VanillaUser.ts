import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { VanillaPhoto } from "./VanillaPhoto";

@Entity()
export class VanillaUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => VanillaPhoto, (photo) => photo.user)
  photos: VanillaPhoto[];
}
