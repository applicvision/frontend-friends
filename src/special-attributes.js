/** @import {SpecialAttribute, TwowayBinding, CustomTwowayBindable, PredicateType} from './types.js' */

/** @type {Map<string, SpecialAttribute<any, any>>} */
export const specialAttributes = new Map()

const specialAttributePrefix = 'ff-'

const specialAttributeRegex = /^[a-z][a-z-]*$/

/**
 * @template ValueType
 * @template {Element} [ElementType=Element]
 * @param {`ff-${string}`} name
 * @param {SpecialAttribute<ValueType, ElementType>} specification
 */
export function registerSpecialAttribute(name, specification) {
	if (specialAttributes.has(name)) {
		throw new Error(`Special attribute ${name} is already registered`)
	}
	if (!name.startsWith(specialAttributePrefix)) {
		throw new Error(`Special attribute should start with ${specialAttributePrefix}`)
	}
	if (!name.slice(3).match(specialAttributeRegex)) {
		throw new Error(`Invalid special attribute name: ${name}`)
	}
	return specialAttributes.set(name, specification)
}

/** @param {string} name */
export function unregisterSpecialAttribute(name) {
	if (name == 'ff-share' || name == 'ff-ref') {
		throw new Error(`Can not remove ${name}`)
	}
	return specialAttributes.delete(name)
}

registerSpecialAttribute('ff-share', {
	isValueValid: value => typeof value == 'object' && value != null,
	isElementValid: element => elementIsNativeControlElement(element) || elementIsTwoWayBindable(element),
	connect(element, currentValue) {
		if (elementIsNativeControlElement(element)) {
			element.addEventListener('input', (event) => handleNativeInputEvent(currentValue, element, event))
		}
	},
	update(element, newValue) {
		if (elementIsNativeControlElement(element)) {
			updateNativeElement(element, getFromBinding(newValue))
		} else {
			element.sharedStateBinding = newValue
		}
	}
})

registerSpecialAttribute('ff-ref', {
	isValueValid: value => value instanceof ElementReference,
	update(element, ref, previous) {
		if (ref == previous) return
		ref.element = element
	}
})

/**
 * @param {() => any} getValue
 * @param {PredicateType<typeof elementIsNativeControlElement>} element
 * @param {Event} event
 */
function handleNativeInputEvent(getValue, element, event) {

	const binding = getValue()

	if (element instanceof HTMLSelectElement) {
		if (element.type == 'select-multiple') {
			if (isTwowayBinding(binding)) {
				const selected = []
				for (const option of element.selectedOptions) {
					selected.push(option.value)
				}
				binding.set(selected, event)
			} else if (isArrayOfStrings(binding)) {

				const selectedOptions = [...element.selectedOptions].map(option => option.value)
				// remove values no longer selected
				for (let index = binding.length - 1; index >= 0; index--) {
					if (!selectedOptions.includes(binding[index])) {
						binding.splice(index, 1)
					}
				}
				// add options previously not selected
				selectedOptions.forEach(option => {
					if (!binding.includes(option)) {
						binding.push(option)
					}
				})
			} else throw new Error('Invalid shared state binding')

		} else setToBindingOrThrow(binding, element.value, event)
		return
	}

	if (element instanceof HTMLTextAreaElement) {
		return setToBindingOrThrow(binding, element.value, event)
	}

	switch (element.type) {
		case 'checkbox':
			const elementCheckedValue = element.value && element.value != 'on' ? element.value : element.name
			if (isTwowayBinding(binding)) { // Update the binding
				const valueBefore = binding.get()
				if (valueBefore instanceof Set) {
					const newSet = new Set(valueBefore)
					element.checked ?
						newSet.add(elementCheckedValue) :
						newSet.delete(elementCheckedValue)
					return binding.set(newSet, event)
				}
				if (valueBefore instanceof Array) {
					const indexBefore = valueBefore.indexOf(elementCheckedValue)
					const newArrayValue = element.checked ?
						valueBefore.concat(elementCheckedValue) :
						valueBefore.toSpliced(indexBefore, 1)
					return binding.set(newArrayValue, event)
				}
				binding.set(element.checked, event)

			} else if (binding instanceof Set) {
				// mutate the set directly
				element.checked ? binding.add(elementCheckedValue) : binding.delete(elementCheckedValue)
			} else if (isArrayOfStrings(binding)) {
				if (element.checked && !binding.includes(elementCheckedValue))
					binding.push(elementCheckedValue)

				if (!element.checked && binding.includes(elementCheckedValue))
					binding.splice(binding.indexOf(elementCheckedValue), 1)

			} else throw new Error('Invalid state binding for checkbox')
			break
		case 'number':
		case 'range':
			return setToBindingOrThrow(binding, element.valueAsNumber, event)
		case 'datetime-local':
			const newValue = new Date(element.value)

			if (isTwowayBinding(binding)) {
				binding.set(newValue)
			} else if (binding instanceof Date) {
				const timestamp = newValue.getTime()
				if (timestamp)
					binding.setTime(timestamp)
				else
					console.warn('Invalid date value for datetime input')
			} else throw new Error('Invalid state binding for datetime-local input')
			break
		case 'date':
		case 'month':
		case 'week':
			if (isTwowayBinding(binding)) {
				binding.set(element.valueAsDate, event)
			} else if (binding instanceof Date) {
				const newDateValue = element.valueAsDate?.getTime()
				if (newDateValue) {
					binding.setTime(newDateValue)
				} else {
					console.warn('Invalid date value for date input')
				}
			} else throw new Error('Invalid state binding for Date input')
			break
		default:
			setToBindingOrThrow(binding, element.value, event)
	}
}

/**
 * @param {PredicateType<typeof elementIsNativeControlElement>} element
 * @param {unknown} newValue
 **/
function updateNativeElement(element, newValue) {

	if (element instanceof HTMLSelectElement) {
		if (element.type == 'select-multiple') {

			if (!isArrayOfStrings(newValue)) {
				console.warn('Please use array with select type=select-multiple')
				return
			}
			for (const option of element.options) {
				option.selected = newValue.includes(option.value)
			}
			return
		}

		if (typeof newValue == 'string') {
			element.value = newValue
		} else {
			console.warn('Please use a string with single select')
		}

		return

	}
	if (element instanceof HTMLTextAreaElement) {
		if (typeof newValue != 'string') {
			console.warn('Please use strings with textarea')
		} else {
			element.value = newValue
		}
		return
	}

	switch (element.type) {
		case 'number':
		case 'range':
			if (typeof newValue != 'number') return console.warn('Please use numbers with input type=number or type=range')


			if (isNaN(newValue)) {
				if (!isNaN(element.valueAsNumber)) {
					element.value = ''
				}
			} else if (element.valueAsNumber != newValue) {
				element.valueAsNumber = newValue
			}

			break
		case 'datetime-local':
			if (newValue instanceof Date) {
				const dateString = `${newValue.toLocaleDateString('sv-SE')}T${newValue.toLocaleTimeString()}`
				element.value = dateString
			} else {
				element.value = String(newValue)
			}
			break
		case 'date':
		case 'month':
		case 'week':
			if (newValue instanceof Date) {
				element.valueAsDate = newValue
			} else {
				console.warn('Please use a Date as value for input type=date|month|week')
			}
			break
		case 'checkbox':
			const elementCheckedValue = element.value && element.value != 'on' ? element.value : element.name
			if (typeof newValue == 'boolean') {
				element.checked = newValue
			} else if (newValue instanceof Set) {
				element.checked = newValue.has(elementCheckedValue)
			} else if (Array.isArray(newValue)) {
				element.checked = newValue.includes(elementCheckedValue)
			} else {
				console.warn('Unexpected type for checkbox input', newValue)
			}
			break
		case 'radio':
			element.checked = newValue == element.value
			break
		case 'text':
			if (typeof newValue != 'string') return console.warn('Unexpected type for input type=string', newValue)

			element.value = newValue
			break
		default:
			element.value = String(newValue)
	}
}


/** @param {Element} element */
function elementIsNativeControlElement(element) {
	return element instanceof HTMLInputElement ||
		element instanceof HTMLSelectElement ||
		element instanceof HTMLTextAreaElement
}

/**
 * @type {(value: unknown) => value is TwowayBinding}
 */
function isTwowayBinding(value) {
	// @ts-ignore
	return typeof value?.get == 'function' && typeof value?.set == 'function'
}

/**
 * @param {unknown} binding
 * @param {unknown} newValue
 * @param {Event} event
 **/
function setToBindingOrThrow(binding, newValue, event) {
	if (!isTwowayBinding(binding)) throw new Error('Please use a two-way binding')

	return binding.set(newValue, event)
}

/**
 * @param {unknown} value
 **/
function getFromBinding(value) {
	return isTwowayBinding(value) ? value.get() : value
}

/**
 * This is not really checking that items are strings. It is serving as a TS type assertion
 * @type {(value: unknown) => value is string[]}
 */
function isArrayOfStrings(value) {
	return Array.isArray(value)
}

/** @type {(element: Element) => element is CustomTwowayBindable} */
function elementIsTwoWayBindable(element) {
	while ((element = Object.getPrototypeOf(element)) && element != HTMLElement.prototype) {
		if (Object.getOwnPropertyDescriptor(element, 'sharedStateBinding')) {
			return true
		}
	}
	return false
}

/** 
 * @template ValueType
 * @template TransformedType 
 * @implements {TwowayBinding}
 **/
class Twoway {

	/** @type {{[key: string|number|symbol]: any}} */
	#stateContainer

	/** @type {string|number|symbol} */
	#property

	/** @type {((newValue: TransformedType) => void)?} */
	#effect = null

	/** @type {unknown} */
	#effectContext = null

	/** @type {((fieldValue: TransformedType) => ValueType)?} */
	#toTransform = null

	/** @type {((stateValue: ValueType) => TransformedType)?} */
	#fromTransform = null

	/**
	 * @param {object} state
	 * @param {string | number | symbol} property
	 * @param {((value: TransformedType) => ValueType)?} toTransform
	 * @param {((value: ValueType) => TransformedType)?} fromTransform
	 * @param {unknown} effectContext
	 */
	constructor(state, property, toTransform = null, fromTransform = null, effectContext = null) {
		this.#stateContainer = state
		this.#property = property
		this.#toTransform = toTransform
		this.#fromTransform = fromTransform
		this.#effectContext = effectContext
	}

	/** @returns {TransformedType} */
	get() {
		const value = this.#stateContainer[this.#property]
		return this.#fromTransform ? this.#fromTransform(value) : value
	}

	/** @param {TransformedType} newValue */
	set(newValue) {
		this.#stateContainer[this.#property] = this.#toTransform ? this.#toTransform(newValue) : newValue
		this.#effect?.call(this.#effectContext, newValue)
	}

	/** @param {(newValue: TransformedType) => void} effect */
	withEffect(effect) {
		this.#effect = effect
		return this
	}
}

/**
 * @template {object} T
 * @template {keyof T} Key
 * @template [TransformedType=T[Key]]
 * @param {T} state
 * @param {Key} property
 * @param {((fieldValue: TransformedType) => T[Key])} [toTransform]
 * @param {((stateValue: T[Key]) => TransformedType)} [fromTransform]
 * @param {unknown} [effectContext]
 * @returns {Twoway<T[Key], TransformedType>}
 */
export function twoway(state, property, toTransform, fromTransform, effectContext) {
	return new Twoway(state, property, toTransform, fromTransform, effectContext)
}

// ff-ref


/** @template {{new (): Element}} [T={new (): Element}] */
class ElementReference {
	/** @type {InstanceType<T>?} */
	#element = null

	#type

	/** @param {T} [type] */
	constructor(type) {
		this.#type = type
	}

	/** @param {InstanceType<T>|null} element */
	set element(element) {
		if (element && this.#type && !(element instanceof this.#type)) {
			throw new Error(`Unexpected element type`)
		}
		this.#element = element
	}

	get element() {
		return this.#element
	}

	get elementOrThrow() {
		if (!this.#element) {
			throw new Error('Missing element reference')
		}
		return this.#element
	}
}

/**
 * @template {{new (): Element}} T
 * @param {T} [type]
 */
export function ref(type) {
	return new ElementReference(type)
}
