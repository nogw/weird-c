export type Pair<L, R> = [L, R];

export const pair = <L, R>(lhs: L, rhs: R): Pair<L, R> => [lhs, rhs];
