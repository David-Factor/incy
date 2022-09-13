import { err, ok, Result } from "./result.ts";

type Assert<T, E> = (v: T) => [boolean, E];

type Parser<In, Err, Out> = {
  run: (v: In) => Result<Out, Err[]>;
  assert: (
    ...f: [Assert<Out, Err>, ...Assert<Out, Err>[]]
  ) => Parser<In, Err, Out>;
  map: <Out2>(f: (v: Out) => Out2) => Parser<In, Err, Out2>;
  andThen: <Out2>(
    f: (v: Out) => Parser<In, Err, Out2>,
  ) => Parser<In, Err, Out2>;
  mapError: <Err2>(f: (e: Err[]) => Err2[]) => Parser<In, Err2, Out>;
  or: <Out2>(a: Parser<In, Err, Out2>) => Parser<In, Err, Out | Out2>;
};

// deno-lint-ignore no-explicit-any
type InferError<T> = T extends Parser<any, infer I, any> ? I : never;
// deno-lint-ignore no-explicit-any
type InferOutput<T> = T extends Parser<any, any, infer I> ? I : never;

const custom = <In, Err, Out>(
  run: (v: In) => Result<Out, Err[]>,
): Parser<In, Err, Out> => ({
  run,
  assert: (...fns) =>
    custom((v) =>
      run(v).andThen((x) => {
        const errors = [];
        for (const f of fns) {
          const [pass, error] = f(x);
          if (!pass) errors.push(error);
        }
        if (errors.length > 0) return err(errors);
        return ok(x);
      })
    ),
  map: (f) => custom((v) => run(v).map(f)),
  andThen: (f) => custom((v) => run(v).andThen((x) => f(x).run(v))),
  mapError: (f) => custom((v) => run(v).mapError(f)),
  or: (b) =>
    custom((value) => {
      const resultA = run(value);
      if (resultA.ok) return ok(resultA.value);
      const resultB = b.run(value);
      if (resultB.ok) return ok(resultB.value);
      return err(resultA.error.concat(resultB.error));
    }),
});

const array = <I, E, O>(
  parser: Parser<I, E, O>,
  error: { expectedArray: E; failedAt: (index: number, errors: E[]) => E[] },
): Parser<I[], E, O[]> =>
  custom((vs) => {
    if (!Array.isArray(vs)) return err([error.expectedArray]);
    const entries = vs.entries();
    const out: O[] = [];
    for (const [index, v] of entries) {
      const result = parser.run(v);
      if (!result.ok) return err(error.failedAt(index, result.error));
      out.push(result.value);
    }
    return ok(out);
  });

const isObject = (a: unknown): a is Record<string, unknown> => {
  return (typeof a === "object" && !Array.isArray(a) && a !== null);
};

const object = <I, E, O>(
  shape: { [K in keyof O]: Parser<I, E, O[K]> },
  error: {
    expectedObject: E;
    expectedKey: (key: string) => E;
    failedAt: (key: string, errors: E[]) => E[];
  },
): Parser<I, E, O> =>
  custom((v) => {
    if (!isObject(v)) return err([error.expectedObject]);
    const entries: [string, Parser<I, E, O>][] = Object.entries(shape);
    const out: Record<string, O> = {};
    for (const [key, parser] of entries) {
      const result = parser.run(v[key] as I);
      if (!result.ok && !(key in v)) {
        return err([error.expectedKey(key)]);
      }
      if (!result.ok) return err(error.failedAt(key, result.error));
      out[key] = result.value;
    }
    return ok(out as unknown as O);
  });

const succeed = <I, E, O>(v: O): Parser<I, E, O> => custom((_) => ok(v));

const fail = <I, E, O>(e: E): Parser<I, E, O> => custom((_) => err([e]));

const string = <I, E>(e: E): Parser<I, E, string> =>
  custom((v) => typeof v === "string" ? ok(v) : err([e]));

const number = <I, E>(e: E): Parser<I, E, number> =>
  custom((v) => typeof v === "number" ? ok(v) : err([e]));

const boolean = <I, E>(e: E): Parser<I, E, boolean> =>
  custom((v) => typeof v === "boolean" ? ok(v) : err([e]));

const undefined_ = <I, E>(e: E): Parser<I, E, undefined> =>
  custom((v) => typeof v === "undefined" ? ok(undefined) : err([e]));

const null_ = <I, E>(e: E): Parser<I, E, null> =>
  custom((v) => (v === null) ? ok(null) : err([e]));

type Primitive =
  | undefined
  | null
  | string
  | number
  | boolean
  | Primitive[]
  | { [key: string]: Primitive };

const literal = <I, E, O extends Primitive>(v: O): Parser<I, E, O> =>
  succeed(v);

const unknown = <I, E>(v: unknown): Parser<I, E, unknown> => succeed(v);

export {
  array,
  boolean,
  custom,
  fail,
  literal,
  null_ as null,
  number,
  object,
  string,
  succeed,
  undefined_ as undefined,
  unknown,
};

export type { Assert, InferError, InferOutput, Parser };
