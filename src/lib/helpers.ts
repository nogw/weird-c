type Expr<D extends string, A, T extends string> = Extract<A, Record<D, T>>;

type Return<D extends string, A extends Record<D, string>, M extends Match<D, A, unknown>> = {
  [K in keyof M]: ReturnType<M[K]>;
}[keyof M];

type Match<D extends string, A extends Record<D, string>, Z> = {
  [K in A[D]]: (v: Expr<D, A, K>) => Z;
};

export type ADT<T extends Record<string, {}>> = {
  [K in keyof T]: Record<"tag", K> & T[K];
}[keyof T];

export const match = (
  <D extends string>(d: D) =>
  <A extends Record<D, string>>(v: A) =>
  <M extends Match<D, A, unknown>>(
    branch: M,
    otherwise?: (_: A) => ReturnType<M[keyof M]> // TODO
  ): Return<D, A, M> =>
    (branch[v[d]] || otherwise)(v as any) as any
)("tag");
