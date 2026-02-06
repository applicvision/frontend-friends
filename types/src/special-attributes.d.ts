import { SpecialAttribute, TwowayBinding } from "../type-utils.js"

/**
 * Register a special attribute to be used in dynamic fragments.
 */
export function registerSpecialAttribute<ValueType, ElementType extends Element = Element>(
	name: `ff-${string}`,
	specification: SpecialAttribute<ValueType, ElementType>
): Map<string, SpecialAttribute<any, any>>

/**
 * Unregister a special attribute.
 */
export function unregisterSpecialAttribute(name: string): boolean

/**
 * Creates a twoway binding which can be passed to the `ff-share` attribute.
 */
export function twoway<T extends object, Key extends keyof T, TransformedType = T[Key]>(
	state: T,
	property: Key,
	toTransform?: ((fieldValue: TransformedType) => T[Key]),
	fromTransform?: ((stateValue: T[Key]) => TransformedType),
	effectContext?: unknown
): Twoway<T[Key], TransformedType>

/**
 * Creates a ref which can be passed to `ff-ref`. Is used to get references to elements in the template.
 */
export function ref<T extends {
	new(): Element
}>(type?: T): ElementReference<T>

export const specialAttributes: Map<string, SpecialAttribute<any, any>>



declare class Twoway<ValueType, TransformedType> implements TwowayBinding {

	constructor(state: object, property: string | number | symbol, toTransform?: ((value: TransformedType) => ValueType) | null, fromTransform?: ((value: ValueType) => TransformedType) | null, effectContext?: unknown)

	get(): TransformedType

	set(newValue: TransformedType): void

	withEffect(effect: (newValue: TransformedType) => void): this
}

declare class ElementReference<T extends {
	new(): Element
} = new () => Element> {

	constructor(type?: T)

	set element(element: InstanceType<T> | null)

	get element(): InstanceType<T> | null

	get elementOrThrow(): InstanceType<T>
}

