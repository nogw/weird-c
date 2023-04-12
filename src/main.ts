import { promises as fs } from "fs";
import { exec } from "child_process";
import path from "path";

import { makeContext, Context } from "./lib/context";
import { makeState, State } from "./lib/state";
import { ADT, match } from "./lib/helpers";
import { Pair } from "./lib/pair";

type Name = string;
type Prop = string;
type Tree = ADT<{
  Num: { data: number };
  Var: { data: Name };
  Lam: { prop: Prop; body: Tree };
  App: { func: Tree; argm: Tree };
  Let: { name: Name; bind: Tree; body: Tree };
}>;

const Num = (data: number): Tree => ({ tag: "Num", data });
const Var = (data: Name): Tree => ({ tag: "Var", data });
const Lam = (prop: Prop, body: Tree): Tree => ({ tag: "Lam", prop, body });
const App = (func: Tree, argm: Tree): Tree => ({ tag: "App", func, argm });
const Let = (name: Name, bind: Tree, body: Tree): Tree => ({ tag: "Let", name, bind, body });

const show = (tree: Tree): string =>
  match(tree)({
    Num: ({ data }) => `${data}`,
    Var: ({ data }) => `${data}`,
    Lam: ({ prop, body }) => `(${prop}) => ${show(body)}`,
    App: ({ func, argm }) => `(${show(func)} ${show(argm)})`,
    Let: ({ name, bind, body }) => `let ${name} = ${show(bind)} in ${show(body)} `,
  });

// Lexer

type Token = ADT<{
  NUMBER: { value: number };
  SYMBOL: { value: string };
  SEMICOLON: {};
  LPAREN: {};
  RPAREN: {};
  COMMA: {};
  EQUAL: {};
  ARROW: {};
  FUN: {};
  LET: {};
  EOF: {};
}>;

const scanner = (source: string): Token[] => {
  const keywords = new Map<string, Token>([
    ["fun", { tag: "FUN" }],
    ["let", { tag: "LET" }],
  ]);

  const tokens: Token[] = [];

  const isDigit = (char: string) => char >= "0" && char <= "9";
  const isAlpha = (char: string) => (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_";
  const isAlphaNumeric = (char: string) => isAlpha(char) || isDigit(char);

  const scanTokens = () => {
    let start_pos = 0;
    let current_pos = 0;

    const isAtEnd = () => current_pos >= source.length;
    const peek = () => (current_pos >= source.length ? "\0" : source.charAt(current_pos));
    const peekNext = () => (current_pos + 1 >= source.length ? "\0" : source.charAt(current_pos + 1));

    const advance = () => {
      current_pos++;
      return source.charAt(current_pos - 1);
    };

    const number = () => {
      while (isDigit(peek())) {
        advance();
      }

      if (peek() === "." && isDigit(peekNext())) {
        advance();

        while (isDigit(peek())) {
          advance();
        }
      }

      const value = parseInt(source.substring(start_pos, current_pos));
      tokens.push({ tag: "NUMBER", value });
    };

    const identifier = () => {
      while (isAlphaNumeric(peek())) {
        advance();
      }

      const value = source.substring(start_pos, current_pos);
      const token = keywords.get(value);

      if (token === undefined) {
        tokens.push({ tag: "SYMBOL", value });
      } else {
        tokens.push(token);
      }
    };

    const matchToken = (expected: string) => {
      if (isAtEnd()) return false;
      if (source.charAt(current_pos) !== expected) return false;
      return advance();
    };

    while (current_pos < source.length) {
      start_pos = current_pos;
      const char = advance();

      switch (char) {
        case " ":
        case "\r":
        case "\n":
        case "\t":
          break;
        case "(":
          tokens.push({ tag: "LPAREN" });
          break;
        case ")":
          tokens.push({ tag: "RPAREN" });
          break;
        case "=":
          tokens.push(matchToken(">") ? { tag: "ARROW" } : { tag: "EQUAL" });
          break;
        case ";":
          tokens.push({ tag: "SEMICOLON" });
          break;
        case ",":
          tokens.push({ tag: "COMMA" });
          break;
        default:
          if (isDigit(char)) {
            number();
          } else if (isAlpha(char)) {
            identifier();
          } else {
            const err = `Unexpected character (${char})`;
            throw new Error(err);
          }

          break;
      }
    }

    tokens.push({ tag: "EOF" });

    return tokens;
  };

  return scanTokens();
};

// Parser

const parser = (initial: Token[]): Tree => {
  let tokens = initial;
  let current = 0;

  const fail = () => {
    const token = peek();
    throw new Error(`Unexpected token ${token}`);
  };

  const isAtEnd = (): boolean => {
    return peek().tag == "EOF";
  };

  const check = (token: Token): boolean => {
    if (isAtEnd()) {
      return false;
    }

    return peek().tag === token.tag;
  };

  const matchToken = (...tokens: Token[]): boolean => {
    for (let i = 0; i < tokens.length; i++) {
      if (check(tokens[i])) {
        advance();
        return true;
      }
    }

    return false;
  };

  const advance = (): Token => {
    if (!isAtEnd()) {
      current++;
    }

    return previous();
  };

  const peek = (): Token => {
    const token = tokens.at(current);

    if (!token) {
      throw new Error("undefined token");
    }

    return token;
  };

  const previous = (): Token => {
    const token = tokens.at(current - 1);

    if (!token) {
      throw new Error("undefined token");
    }

    return token;
  };

  const isToken = <T extends Token["tag"]>(tag: T): ((token: Token) => token is Extract<Token, { tag: T }>) => {
    return (token): token is Extract<Token, { tag: T }> => token.tag === tag;
  };

  const consume = <T>(expect: (_: Token) => T) => {
    const currentToken = peek();
    const expectedValue = expect(currentToken);

    if (!expectedValue) {
      const msg = `Parser error with ${currentToken.tag}`;
      throw new Error(msg);
    }

    advance();
    return expectedValue;
  };

  const consumeToken = <T extends Token["tag"], R>(tag: T, callback?: (value: Extract<Token, { tag: T }>) => R): R => {
    return consume((token) => {
      if (!isToken(tag)(token)) {
        throw new Error(`Expected token with tag "${tag}", but got "${token.tag}"`);
      }

      return callback ? callback(token) : (token as unknown as R);
    });
  };

  const parseNumber = (): Tree => {
    return Num(consumeToken("NUMBER", (token) => token.value));
  };

  const parseSymbol = (): Tree => {
    return Var(consumeToken("SYMBOL", (token) => token.value));
  };

  const parseParens = (): Tree => {
    consumeToken("LPAREN");
    const value = expression();
    consumeToken("RPAREN");

    return value;
  };

  const parseAtom = (): Tree => {
    if (isToken("NUMBER")(peek())) return parseNumber();
    if (isToken("SYMBOL")(peek())) return parseSymbol();
    if (isToken("LPAREN")(peek())) return parseParens();

    return fail();
  };

  const expression = (): Tree => {
    if (matchToken({ tag: "LET" })) return parseLet();
    if (matchToken({ tag: "FUN" })) return parseFun();

    return parseApp();
  };

  const parseLet = (): Tree => {
    const name = consumeToken("SYMBOL", (token) => token.value);
    consumeToken("EQUAL");
    const bind = expression();
    consumeToken("SEMICOLON");
    const body = expression();

    return Let(name, bind, body);
  };

  const parseFun = (): Tree => {
    const param = consumeToken("SYMBOL", (token) => token.value);
    consumeToken("ARROW");
    const body = expression();

    return Lam(param, body);
  };

  const parseApp = (): Tree => {
    const func = parseAtom();

    if (matchToken({ tag: "LPAREN" })) {
      return parseCall(func);
    }

    return func;
  };

  const parseCall = (func: Tree): Tree => {
    const args = [];

    while (true) {
      args.push(expression());

      if (matchToken({ tag: "COMMA" })) {
        continue;
      }

      matchToken({ tag: "RPAREN" });
      break;
    }

    return args.reduce((fn, arg) => App(fn, arg), func);
  };

  return expression();
};

const free = (tree: Tree): Set<string> =>
  match(tree)({
    Var: ({ data }) => new Set([data]),
    Num: ({ data: _ }) => new Set([]),
    Lam: ({ prop, body }) => {
      const freeProp = free(body);
      return new Set([...freeProp].filter((x) => x !== prop));
    },
    App: ({ func, argm }) => {
      const freeFunc = free(func);
      const freeArgm = free(argm);
      return new Set([...freeFunc, ...freeArgm]);
    },
    Let: ({ name, bind, body }) => {
      const freeBind = free(bind);
      const freeExpr = [...freeBind].filter((x) => x !== name);
      const freeBody = free(body);
      return new Set([...freeExpr, ...freeBody]);
    },
  });

type Expr = ADT<{
  Num: { data: number };
  Ref: { data: string };
  Idx: { data: string; idx: number };
  App: { func: Name; argm: Expr };
  Cls: { prop: Prop; body: Expr[] };
  Let: { name: Name; bind: Expr; body: Expr };
}>;

type Topl = ADT<{
  Decl: { free: number; name: Name; env: Prop; prop: Prop; body: Expr };
  Main: { expr: Expr };
}>;

type Prog = Topl[];
type Code = string;
type Build = (_: string) => Code;

const ERef = (data: Name): Expr => ({ tag: "Ref", data });
const ENum = (data: number): Expr => ({ tag: "Num", data });
const EIdx = (data: Name, idx: number): Expr => ({ tag: "Idx", data, idx });
const ECls = (prop: Prop, body: Expr[]): Expr => ({ tag: "Cls", prop, body });
const EApp = (func: Name, argm: Expr): Expr => ({ tag: "App", func, argm });
const ELet = (name: Name, bind: Expr, body: Expr): Expr => ({ tag: "Let", name, bind, body });

const TMain = (expr: Expr): Topl => ({ tag: "Main", expr });
const TDecl = (free: number, name: Name, env: Prop, prop: Prop, body: Expr): Topl => ({
  tag: "Decl",
  free,
  name,
  env,
  prop,
  body,
});

const substituteRef = (map: Context<Expr>, data: Name): Expr =>
  match(map.get(data))({
    Some: ({ value }) => value,
    None: ({}) => ERef(data),
  });

const substituteLet = (map: Context<Expr>, name: Name, bind: Expr, body: Expr): Expr => {
  const newBind = substitute(map, bind);
  const newBody = substitute(map.del(name), body);
  const newExpr = ELet(name, newBind, newBody);

  return newExpr;
};

const substituteCls = (map: Context<Expr>, prop: Prop, body: Expr[]): Expr => {
  const newBody = body.map((expr) => substitute(map, expr));
  const newExpr = ECls(prop, newBody);

  return newExpr;
};

const substituteApp = (map: Context<Expr>, func: Name, argm: Expr): Expr => {
  const newArgm = substitute(map, argm);
  const newExpr = EApp(func, newArgm);

  return newExpr;
};

const substitute = (map: Context<Expr>, expr: Expr): Expr =>
  match(expr)({
    Num: ({ data }) => ENum(data),
    Idx: ({ data, idx }) => EIdx(data, idx),
    Ref: ({ data }) => substituteRef(map, data),
    Cls: ({ prop, body }) => substituteCls(map, prop, body),
    App: ({ func, argm }) => substituteApp(map, func, argm),
    Let: ({ name, bind, body }) => substituteLet(map, name, bind, body),
  });

type Converted = Pair<Prog, Pair<Expr, State>>;

const convertNum = (state: State, data: number): Converted => {
  const num = ENum(data);
  return [[], [num, state]];
};

const convertVar = (state: State, data: Name): Converted => {
  const ref = ERef(data);
  return [[], [ref, state]];
};

const convertLam = (state0: State, prop: Name, body: Tree): Converted => {
  const [i, state1] = state0.next();
  const [j, state2] = state1.next();

  const lam = Lam(prop, body);
  const fvs = Array.from(free(lam));
  const env = `env${i}`;
  const cls = `cls${j}`;
  const sub = makeContext(fvs.map((varName, idx) => [varName, EIdx(env, idx)]));

  const [xs, [res, state3]] = convert(state2, body);
  const [bd, newIndexes] = [substitute(sub, res), state3];

  const code = TDecl(fvs.length, cls, env, prop, bd);
  const refs = fvs.map((fv) => ERef(fv));
  const clos = ECls(cls, refs);

  return [
    [...xs, code],
    [clos, newIndexes],
  ];
};

const convertApp = (state0: State, func: Tree, argm: Tree): Converted => {
  const [funProg, [expr, state1]] = convert(state0, func);
  const [nextVar, state3] = state1.next();
  const [argProg, [body, state4]] = convert(state3, argm);

  const value = ELet(`_${nextVar}`, expr, EApp(`_${nextVar}`, body));
  const progs = [...funProg, ...argProg];

  return [progs, [value, state4]];
};

const convertLet = (state0: State, name: Name, bind: Tree, body: Tree): Converted => {
  let [bindProg, [expr, state1]] = convert(state0, bind);
  let [bodyProg, [code, state2]] = convert(state1, body);

  const value = ELet(name, expr, code);
  const progs = [...bindProg, ...bodyProg];

  return [progs, [value, state2]];
};

const convert = (state: State, tree: Tree): Converted =>
  match(tree)({
    Num: ({ data }) => convertNum(state, data),
    Var: ({ data }) => convertVar(state, data),
    Lam: ({ prop, body }) => convertLam(state, prop, body),
    App: ({ func, argm }) => convertApp(state, func, argm),
    Let: ({ name, bind, body }) => convertLet(state, name, bind, body),
  });

const convertCls = (tree: Tree): Prog => {
  const [decs, [code, _]] = convert(makeState(), tree);
  return [...decs, TMain(code)];
};

const indent = (str: string): string => {
  return str
    .split("\n")
    .map((line) => "  " + line)
    .join("\n");
};

const bindReturn = (bind: Name): Build => {
  return (body: Name) => `${bind} = ${body};`;
};

const exprReturn = (expr: Name): Code => {
  return `return ${expr};`;
};

const callReturn = (expr: Name): Code => {
  return `print_val(${expr});`;
};

const sameReturn = (expr: Name): Code => {
  return `${expr}`;
};

const codegenRef = (build: Build, data: string): Code => {
  return build(data);
};

const codegenNum = (build: Build, data: number): Code => {
  return build(`build_int(${data})`);
};

const codegenIdx = (build: Build, data: string, index: number): Code => {
  return build(`${data}[${index}]`);
};

const codegenApp = (build: Build, func: Name, argm: Expr): Code => {
  const code = codegenExpr(sameReturn, argm);
  const expr = `${func}->c.code(${func}->c.env, ${code})`;

  return build(expr);
};

const codegenLet = (build: Build, name: Name, bind: Expr, body: Expr): Code => {
  const expr = bindReturn(name);
  const code = codegenExpr(expr, bind);
  const cont = codegenExpr(build, body);

  return [`struct val *${name};`, code, cont].join("\n");
};

const codegenCls = (build: Build, prop: Prop, body: Expr[]): Code => {
  const code = body.map((expr) => codegenExpr(build, expr));
  const cont = code.join(", ");

  return build(`build_cls(${prop}, (struct val *[${body.length}]){ ${cont} })`);
};

const codegenDecl = (free: number, name: Name, env: Prop, prop: Prop, body: Expr): Code => {
  const code = codegenExpr(exprReturn, body);
  const expr = [`struct val *${name} (struct val *${env}[${free}], struct val *${prop}) {`, indent(code), "}"];

  return expr.join("\n");
};

const codegenMain = (body: Expr): Code => {
  const code = codegenExpr(callReturn, body);
  const expr = ["int main(void) {", indent(code), "}"];

  return expr.join("\n");
};

const codegenExpr = (build: Build, expr: Expr): Code =>
  match(expr)({
    Num: ({ data }) => codegenNum(build, data),
    Ref: ({ data }) => codegenRef(build, data),
    Idx: ({ data, idx }) => codegenIdx(build, data, idx),
    App: ({ func, argm }) => codegenApp(build, func, argm),
    Cls: ({ prop, body }) => codegenCls(build, prop, body),
    Let: ({ name, bind, body }) => codegenLet(build, name, bind, body),
  });

const codegenTopl = (topl: Topl): Code =>
  match(topl)({
    Decl: ({ free, name, env, prop, body }) => codegenDecl(free, name, env, prop, body),
    Main: ({ expr }) => codegenMain(expr),
  });

const codegenProg = (prog: Prog): Code => {
  const incl = ['#include "driver.c"'];
  const expr = prog.map((decl) => codegenTopl(decl));
  const code = [...incl, ...expr];

  return code.join("\n\n");
};

const writeOutput = async (outPath: string, code: string) => {
  const fileExt = `${outPath}.c`;
  const dirPath = path.dirname(fileExt);

  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  await fs.writeFile(fileExt, code);
};

const compileMain = async (outPath: string) => {
  const command = `gcc -o ${outPath} ${outPath}.c`;

  try {
    const { stdout } = await exec(command);
    console.log(`C file (${outPath}) compiled successfully: ${stdout}`);
  } catch (error) {
    console.error(`Error compiling C file: ${error}`);
    throw error;
  }
};

const driver = async (source: string) => {
  const scan = scanner(source);
  const prog = parser(scan);
  const conv = convertCls(prog);
  const code = codegenProg(conv);

  const outFile = "main";
  const outPath = path.join(process.cwd(), "output", outFile);

  try {
    await writeOutput(outPath, code);
    await compileMain(outPath);
  } catch (error) {
    console.error(`Error: ${error}`);
    throw error;
  }
};

(async () => {
  // todo: fix env
  await driver(`
    let id = fun x => x;
    let fx = fun f => fun x => x;
    fx(id, 5) 
  `);
})();
