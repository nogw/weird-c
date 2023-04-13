import { Option, OptionType } from "./option";

type Key = string;
type PolyMap<T> = Map<Key, T>;

interface Context<T> {
  map: PolyMap<T>;
  get(key: Key): OptionType<T>;
  del(key: Key): Context<T>;
  set(key: Key, val: T): Context<T>;
}

const makeContext = <T>(entries?: [Key, T][] | null): Context<T> => {
  const map = new Map<Key, T>(entries);

  const get = (key: Key): OptionType<T> => {
    const value = map.get(key);
    return Option.of(value);
  };

  const del = (key: Key): Context<T> => {
    map.delete(key);
    return context;
  };

  const set = (key: Key, val: T): Context<T> => {
    map.set(key, val);
    return context;
  };

  const context: Context<T> = {
    map,
    get,
    del,
    set,
  };

  return context;
};

export type { Context };
export type { PolyMap };
export { makeContext };
