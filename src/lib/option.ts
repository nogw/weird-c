import { ADT, match } from "./helpers";
import { Error } from "./error";

type Maybe<T> = T | null | undefined;

type Option<A> = ADT<{
  Some: { value: A };
  None: {};
}>;

const of = <A>(value: Maybe<A>): Option<A> => {
  if (value === null || value === undefined) {
    return { tag: "None" } as Option<A>;
  }

  return { tag: "Some", value };
};

const unwrap = <A>(expr: Option<A>): A =>
  match(expr)({
    Some: ({ value }) => value,
    None: ({}) => Error.raise("unwrap fails"),
  });

const unwrap_or = <A>(expr: Option<A>, or: A): A =>
  match(expr)({
    Some: ({ value }) => value,
    None: ({}) => or,
  });

const Option = {
  Some: <T>(value: T): Option<T> => ({ tag: "Some", value }),
  None: <T = never>(): Option<T> => ({ tag: "None" }),
  unwrap_or,
  unwrap,
  of,
};

export type { Option as OptionType };
export { Option };
