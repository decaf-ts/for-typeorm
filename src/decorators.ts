import {
  Constructor,
  ModelKeys,
  ValidationKeys,
} from "@decaf-ts/decorator-validation";

export const ObjectKeySplitter = ".";
export const BaseKey = "decaf";

function getValueBySplitter(
  obj: Record<string, any>,
  path: string,
  splitter: string = ObjectKeySplitter
): any {
  const keys = path.split(splitter);
  let current = obj;

  for (const key of keys) {
    if (
      current === null ||
      current === undefined ||
      !Object.prototype.hasOwnProperty.call(current, key)
    )
      return undefined;
    current = current[key];
  }

  return current;
}

function setValueBySplitter(
  obj: Record<string, any>,
  path: string,
  value: any,
  splitter = ObjectKeySplitter
): void {
  const keys = path.split(splitter);
  let current: Record<any, any> = obj;

  for (const key of keys) {
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
}

export type ModelMetadata = {
  properties: Record<string, any>;
  validation?: Record<string, any[]>;
  relations?: Record<string, any>;
  generated?: Record<string, any>;
  pk: string;
  fks?: Record<string, any>;
  indexes?: Record<string, any>;
};

export class Metadata {
  private static _metadata: Record<symbol, ModelMetadata> = {};

  static splitter = ObjectKeySplitter;
  static baseKey = BaseKey;
  static mirror: boolean = true;

  private constructor() {}

  static getProperties(model: Constructor<any>) {
    const meta = this.get(model);
    if (!meta) return undefined;
    return Object.keys(meta.properties);
  }

  static pk(model: Constructor<any>) {
    const meta = this.get(model);
    if (!meta) return undefined;
    return Object.keys(meta.pk)[0];
  }

  static type(model: Constructor<any>, prop: string) {
    return this.types(model, prop)[0];
  }

  static types(model: Constructor<any>, prop: string) {
    let designType: any = this.get(model, `properties.${prop}`);
    if (!designType)
      throw new Error(`Property ${prop} not found in ${model.name}`);
    designType = [designType];
    const symbol = Symbol.for(model.toString());
    if (this._metadata[symbol]) {
      const meta = this._metadata[symbol];
      if (meta.validation) {
        const validation = meta.validation;
        if (validation[ValidationKeys.TYPE])
          designType = designType.concat(validation[ValidationKeys.TYPE]);
      }
    }
    return designType.filter(Boolean);
  }

  static get(model: Constructor<any>): ModelMetadata | undefined;
  static get(model: Constructor<any>, key: string): any;
  static get(model: Constructor<any>, key?: string) {
    const symbol = Symbol.for(model.toString());
    if (!this._metadata[symbol]) return undefined;
    if (!key) return this._metadata[symbol];
    return getValueBySplitter(this._metadata[symbol], key, this.splitter);
  }

  static set(model: Constructor<any>, key: string, value: any) {
    const symbol = Symbol.for(model.toString());
    if (!this._metadata[symbol]) this._metadata[symbol] = {} as any;
    if (
      this.mirror &&
      !Object.prototype.hasOwnProperty.call(model, this.baseKey)
    ) {
      Object.defineProperty(model, this.baseKey, {
        enumerable: false,
        configurable: false,
        writable: false,
        value: this._metadata[symbol],
      });
    }
    setValueBySplitter(this._metadata[symbol], key, value, this.splitter);
  }
}

export function assign(key: string, value: any) {
  return function assign(
    model: object,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    prop?: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    descriptor?: PropertyDescriptor
  ) {
    Metadata.set(model as any, key, value);
  };
}

export function property() {
  return function property(model: object, prop: any) {
    const designType = Reflect.getOwnMetadata(ModelKeys.TYPE, model, prop);
    return assign(`property.${prop}`, designType)(model, prop);
  };
}
