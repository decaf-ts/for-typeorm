import { getMetadataArgsStorage, Index } from "typeorm";

/**
 * Per-entity state the TypeORM decorator overrides share, so that the
 * result does not depend on the order in which a property's decorators run
 * (or are re-applied by `uses(TypeORMFlavour)`).
 */
const transientProps = new WeakMap<object, Set<string>>();
const readonlyProps = new WeakMap<object, Set<string>>();

function add(map: WeakMap<object, Set<string>>, target: object, prop: string) {
  const set = map.get(target) ?? new Set<string>();
  set.add(prop);
  map.set(target, set);
}

/** Whether `@transient()` marked the property (no column at all). */
export function isTypeORMTransient(target: object, prop: string): boolean {
  return !!transientProps.get(target)?.has(prop);
}

/** Whether `@readonly()` marked the property (`update: false`). */
export function isTypeORMReadonly(target: object, prop: string): boolean {
  return !!readonlyProps.get(target)?.has(prop);
}

/**
 * `@transient()`: the property is not persisted. Removes whatever TypeORM
 * registrations decorators applied before this one left for it (columns,
 * generation strategies, indexes over it); the column overrides applied after
 * it skip the property.
 */
export function markTypeORMTransient(target: object, prop: string): void {
  add(transientProps, target, prop);
  const storage = getMetadataArgsStorage();
  const drop = (list: { target: unknown; propertyName?: string }[]) => {
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].target === target && list[i].propertyName === prop) list.splice(i, 1);
    }
  };
  drop(storage.columns as any);
  drop(storage.generations as any);
  for (let i = storage.indices.length - 1; i >= 0; i--) {
    const index = storage.indices[i];
    const columns = Array.isArray(index.columns) ? (index.columns as string[]) : [];
    // A property-level `@Index()` records its property in `columns` too.
    if (index.target === target && columns.includes(prop)) storage.indices.splice(i, 1);
  }
}

/**
 * `@readonly()`: the column is never written after the insert. Sets
 * `update: false` on the property's existing column registrations (TypeORM
 * uses the first one, so all of them); column overrides applied after it add
 * the option themselves.
 */
export function markTypeORMReadonly(target: object, prop: string): void {
  add(readonlyProps, target, prop);
  for (const column of getMetadataArgsStorage().columns) {
    if (column.target === target && column.propertyName === prop) {
      (column.options as { update?: boolean }).update = false;
    }
  }
}

/**
 * `@index()`: a class-level TypeORM index on the entity over the property
 * and its compositions — once per distinct column list (a re-applied or
 * repeated `@index` adds nothing), never over a transient property.
 *
 * @param target - The entity constructor (the decorated prototype's constructor).
 * @param columns - Property names: the decorated one, then its compositions.
 * @param name - Explicit index name, if the decorator gave one.
 */
export function registerTypeORMIndex(
  target: object,
  columns: string[],
  name?: string
): void {
  if (columns.some((column) => isTypeORMTransient(target, column))) return;
  const key = columns.join(",");
  const exists = getMetadataArgsStorage().indices.some(
    (index) =>
      index.target === target &&
      Array.isArray(index.columns) &&
      (index.columns as string[]).join(",") === key
  );
  if (exists) return;
  (name ? Index(name, columns) : Index(columns))(target as any);
}
