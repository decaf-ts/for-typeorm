import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { VanillaUser } from "./VanillaUser";

@Entity()
export class VanillaPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  url: string;

  @ManyToOne(() => VanillaUser, (user) => user.photos)
  user: VanillaUser;
}
