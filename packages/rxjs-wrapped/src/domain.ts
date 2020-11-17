import { noop, Observable } from "rxjs";

const wrapped = "___wrapped___"
const symbol = Symbol.for(wrapped)

type HasFlag = { [wrapped]: typeof symbol }

export type Fulfilled<T> = {
  status: "fulfilled"
  value: T
}
export type Pending = {
  status: "pending"
}
export type Rejected = {
  status: "rejected"
  error: any
  reload: () => void
}

export type WrappedObservable<T> = Observable<T | Wrapped<T>>

export type Wrapped<T> = (Fulfilled<T> | Pending | Rejected) & HasFlag

export const pending: Wrapped<any> = { status: "pending", [wrapped]: symbol }

export function createRejected(error: any, reload: () => void = noop): Wrapped<any> {
  return {
    status: "rejected",
    error,
    reload,
    [wrapped]: symbol
  }
}

export function createFulfilled<T>(value: T): Fulfilled<T> & HasFlag {
  return {
    status: "fulfilled",
    value,
    [wrapped]: symbol,
  }
}

export function isWrapped(value: any) {
  return value && value[wrapped] === symbol
}
