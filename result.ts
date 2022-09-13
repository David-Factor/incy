export type Result<T, E> =
  & (
    | { ok: true; value: T }
    | { ok: false; error: E }
  )
  & ResultMethods<T, E>;

type ResultMethods<T, E> = {
  map: <T2>(f: (a: T) => T2) => Result<T2, E>;
  andThen: <T2>(f: (a: T) => Result<T2, E>) => Result<T2, E>;
  mapError: <E2>(f: (e: E) => E2) => Result<T, E2>;
};

export const ok = <T, E>(value: T): Result<T, E> => ({
  ok: true,
  value,
  map: (f) => ok(f(value)),
  andThen: (f) => f(value),
  mapError: () => ok(value),
});

export const err = <T, E>(error: E): Result<T, E> => ({
  ok: false,
  error,
  map: () => err(error),
  andThen: () => err(error),
  mapError: (f) => err(f(error)),
});
