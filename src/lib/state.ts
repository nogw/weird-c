import { pair, Pair } from "./pair";

interface State {
  curr: number;
  next: () => Pair<number, State>;
}

const StateProto: State = {
  curr: 0,
  next() {
    this.curr += 1;
    return pair(this.curr, this);
  },
};

const makeState = (): State => Object.create(StateProto);

export { makeState };
export type { State };
