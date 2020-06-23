import React, { ReactNode, useCallback, useMemo } from "react"
import { Cache } from "./cache"
import { Rx, LoaderProps, OrReactChild } from "./rx"
import { mergePromiseStates } from "./merge"
import { save } from "./save"
import { useRxChange } from "@rixio/rxjs-react"
import { map } from "rxjs/operators"
import { PromiseStatus } from "./promise-state"

type CacheablePropsBase = Omit<LoaderProps<any>, "state$" | "rejected" | "children"> & {
	rejected?: OrReactChild<(error: any, load: () => void) => ReactNode>
}

type Cacheable1Props<T> = {
	cache: Cache<T>
	children?: OrReactChild<(value: T) => ReactNode>
} & CacheablePropsBase

type Cacheable2Props<T1, T2> = {
	cache: [Cache<T1>, Cache<T2>]
	children?: OrReactChild<(value: [T1, T2]) => ReactNode>
} & CacheablePropsBase

type CacheableProps = {
	cache: any
	children?: any
} & CacheablePropsBase

function getCaches(cache: any): Cache<any>[] {
	if (Array.isArray(cache)) {
		return cache
	} else {
		return [cache]
	}
}

export function Cacheable<T>(props: Cacheable1Props<T>): React.ReactElement | null
export function Cacheable<T1, T2>(props: Cacheable2Props<T1, T2>): React.ReactElement | null
export function Cacheable({ cache, children, rejected, ...rest }: CacheableProps): React.ReactElement | null {
	const array = getCaches(cache)
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const caches: Cache<any>[] = useMemo(() => array, array)
	const single = useMemo(() => mergePromiseStates(caches.map(x => x.atom)), [caches])
	useRxChange(single.pipe(map(x => x.status)), s => {
		if (s !== "fulfilled") {
			load(caches, "idle")
		}
	}, [caches])
	const reload = useCallback(() => load(caches, "idle", "rejected"), [caches])
	const newRejected = useCallback((err: any) => {
		if (typeof rejected === "function") {
			return rejected(err, reload)
		} else {
			return rejected
		}
	}, [rejected, reload])
	const newChildren = useCallback(value => {
		let realValue: any
		if (Array.isArray(cache)) {
			realValue = value
		} else {
			realValue = value[0]
		}
		if (typeof children === "function") {
			return children(realValue)
		} else if (children) {
			return children
		} else {
			return realValue
		}
	}, [cache, children])

	return <Rx state$={single} {...rest} rejected={newRejected} children={newChildren}/>
}

function load(caches: Cache<any>[], ...statuses: PromiseStatus["status"][]) {
	caches.forEach(c => {
		let status = c.atom.get().status
		if (statuses.indexOf(status) !== -1) {
			save(c.load(), c.atom).then()
		}
	})
}