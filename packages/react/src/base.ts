import React from "react"
import { Observable, Subscription } from "rxjs"
import { Lens } from "@rixio/lens"
import { Wrapped, createRejectedWrapped, toWrapped, pendingWrapped, Rejected, Lifted } from "@rixio/wrapped"

export type OrReactChild<T> = React.ReactChild | React.ReactChild[] | T

export type RxBaseProps = {
	pending?: React.ReactNode
	rejected?: OrReactChild<(error: any, reload: () => void) => React.ReactNode>
}

export abstract class RxWrapperBase<P extends object, RProps extends object> extends React.Component<
	RProps,
	Lifted<P>
> {
	private _state: Lifted<P>
	private _mounted: boolean = false
	private subscriptions: Map<Observable<any>, [Subscription, Lens<Lifted<P>, any>]> = new Map()

	constructor(props: RProps) {
		super(props)
		this._state = this.extractProps(props)
		this.doSubscribe({} as Lifted<P>, this._state)
		this.state = this._state
	}

	abstract extractRxBaseProps(props: RProps): RxBaseProps | undefined

	abstract extractProps(props: RProps): Lifted<P>

	abstract extractComponent(props: RProps): any

	componentDidMount() {
		this._mounted = true
	}

	componentWillUnmount() {
		this.subscriptions.forEach(([subscription], key, map) => {
			if (!subscription.closed) {
				subscription.unsubscribe()
			}
			map.delete(key)
		})
		this._mounted = false
	}

	shouldComponentUpdate(nextProps: Readonly<RProps>, nextState: Readonly<Lifted<P>>, nextContext: any): boolean {
		if (this.props !== nextProps) {
			const oldProps = this.extractProps(this.props)
			const newProps = this.extractProps(nextProps)
			this.doUnsubscribe(oldProps, newProps)
			this.doSubscribe(oldProps, newProps)
			this.setState(this._state)
		}
		return true
	}

	render() {
		const result = toWrapped(this.checkObservables())
		switch (result.status) {
			case "fulfilled":
				return React.createElement(this.extractComponent(this.props), result.value as P)
			case "pending":
				const pending = this.extractRxBaseProps(this.props)?.pending
				if (pending) {
					return pending
				}
				return null
			case "rejected":
				const rejected = this.extractRxBaseProps(this.props)?.rejected
				if (rejected && typeof rejected === "function") {
					return rejected(result.error, result.reload)
				} else if (rejected) {
					return rejected
				} else {
					return null
				}
		}
	}

	private doSubscribe(oldProps: Lifted<P>, props: Lifted<P>) {
		walk(props, (value, lens) => {
			if (value instanceof Observable) {
				let oldValue: any
				try {
					oldValue = lens.get(oldProps)
				} catch (e) {
					oldValue = undefined
				}
				if (oldValue !== value) {
					const s = value.subscribe(
						plain => this.handle(lens, toWrapped(plain)),
						error => this.handle(lens, createRejectedWrapped(error))
					)
					this.subscriptions.set(value, [s, lens])
				}
			} else {
				this._state = lens.set(value, this._state)
			}
		})
	}

	private doUnsubscribe(oldProps: Lifted<P>, newProps: Lifted<P>) {
		walk(oldProps, (value, lens) => {
			if (value instanceof Observable && lens.get(newProps) !== value) {
				const sub = this.subscriptions.get(value)
				if (sub && !sub[0].closed) {
					sub[0].unsubscribe()
				}
				this.subscriptions.delete(value)
			}
		})
	}

	private handle(lens: Lens<Lifted<P>, any>, value: any) {
		const newState = lens.set(value, this._state)
		if (newState !== this._state) {
			this._state = newState
			if (this._mounted) {
				this.setState(newState)
			}
		}
	}

	private checkObservables(): Lifted<P> | Wrapped<any> {
		let foundPending = false
		const rejected: Rejected[] = []
		let props = this._state
		walk(this._state, (value, lens) => {
			if (value instanceof Observable) {
				foundPending = true
			}
			const wrapped = toWrapped(value)
			if (wrapped.status === "rejected") {
				rejected.push(wrapped)
			} else if (wrapped.status === "pending") {
				foundPending = true
			} else {
				props = lens.set(wrapped.value, props)
			}
		})
		if (foundPending) return pendingWrapped
		if (rejected.length > 0) {
			const reload = () => {
				rejected.forEach(r => r.reload())
				this.subscriptions.forEach(([s, lens], obs) => {
					if (!s.closed) {
						s.unsubscribe()
					}
					const newSubscription = obs.subscribe(
						plain => this.handle(lens, toWrapped(plain)),
						error => this.handle(lens, createRejectedWrapped(error))
					)
					this.subscriptions.set(obs, [newSubscription, lens])
				})
			}
			return createRejectedWrapped(rejected[0].error, reload)
		}
		return props
	}
}

function walk<T extends object, R>(props: T, handler: (value: any, lens: Lens<T, any>) => R | undefined) {
	for (const key in props) {
		if (props.hasOwnProperty(key)) {
			const prop = props[key] as any
			if (key === "children" && Array.isArray(prop)) {
				for (let i = 0; i < prop.length; i++) {
					const result = handler(prop[i], Lens.compose(Lens.key("children"), Lens.index(i)) as any)
					if (result !== undefined) {
						return result
					}
				}
			} else {
				const result = handler(prop, Lens.key(key) as any)
				if (result !== undefined) {
					return result
				}
			}
		}
	}
}
