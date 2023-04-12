import { Option, OptionType } from "./option";

type Key = string;
type PolyMap<T> = Map<Key, T>;

interface Context<T> {
  get(key: Key): OptionType<T>;
  del(key: Key): Context<T>;
  set(key: Key, val: T): Context<T>;
}

interface ContextProto<T> {
  map: PolyMap<T>;
  get(this: ContextProto<T>, key: Key): OptionType<T>;
  del(this: ContextProto<T>, key: Key): Context<T>;
  set(this: ContextProto<T>, key: Key, t: T): Context<T>;
}

const contextProto: ContextProto<any> = {
  map: new Map<Key, any>(),
  get(key: Key): OptionType<any> {
    const value = this.map.get(key);
    return Option.of(value);
  },
  del(key: Key): Context<any> {
    this.map.delete(key);
    return this;
  },
  set(key: Key, t: any): Context<any> {
    this.map.set(key, t);
    return this;
  },
};

const makeContext = <T>(entries?: [Key, T][] | null): Context<T> => {
  const context: Context<T> = Object.create(contextProto);

  if (entries) {
    for (const [key, value] of entries) {
      context.set(key, value);
    }
  }

  return context;
};

export type { Context };
export type { PolyMap };
export { makeContext };
