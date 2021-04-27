import { combineLatest, Observable } from "rxjs"
import { Atom } from "@rixio/atom"
import { map } from "rxjs/operators"
import type { Validate, ValidationResult, ValidationResultSuccess, ValidationResultValidating } from "./domain"
import { createValidationResult } from "./utils/create-validation-result"

export * from "./is-submit-disabled"
export * from "./utils/validate-joi"
export const noErrors: ValidationResultSuccess = { status: "success" }
export const validating: ValidationResultValidating = { status: "validating" }

export class FormStore<T> {
	canSubmit$: Observable<boolean>
	private readonly nonce$ = Atom.create(0)
	readonly validationResult: Observable<ValidationResult<T>>
	private readonly bindCache: Map<keyof T, FormStore<any>> = new Map()

	constructor(public readonly value: Atom<T>, public readonly _validationResult: Observable<ValidationResult<T>>) {
		this.validationResult = combineLatest([_validationResult, this.nonce$]).pipe(map(([x]) => x))
		this.canSubmit$ = this.validationResult.pipe(map(it => it.status === "success"))
	}

	bind<K extends keyof T>(field: K): FormStore<T[K]> {
		const cached = this.bindCache.get(field)
		if (cached) {
			return cached
		}
		const created = new FormStore(this.value.lens(field), this.getChild(field))
		this.bindCache.set(field, created)
		return created
	}

	triggerUpdate() {
		this.nonce$.modify(x => x + 1)
	}

	private getChild<K extends keyof T>(field: K) {
		return this.validationResult.pipe(
			map(x => {
				if (x.status === "validating") {
					return { status: "validating" } as ValidationResultValidating
				}
				if (x.status === "error" && x.children?.[field]) {
					return x.children[field] as ValidationResult<T[K]>
				}
				return { status: "success" } as ValidationResultSuccess
			})
		)
	}

	static create<K>(value: Atom<K>, validate: Validate<K>) {
		return new FormStore(value, createValidationResult(value, validate))
	}
}
