/**
 * @param {{[key: string]: unknown} | string} definition
 * @param {Set<string>} tokenSet
 */
function addTokensFromDefinition(definition, tokenSet) {
	if (!definition) return
	switch (typeof definition) {
		case 'string': return addTokensFromString(definition, tokenSet)
		case 'object':
			Object.entries(definition)
				.filter(([_, value]) => value)
				.forEach(([key]) => addTokensFromString(key, tokenSet))
	}
}

/**
 * @param {string} stringWithTokens
 * @param {Set<string>} tokenSet
 */
function addTokensFromString(stringWithTokens, tokenSet) {
	stringWithTokens.split(' ').filter(Boolean)
		.forEach(token => tokenSet.add(token))
}


/**
 * @param {({[key: string]: unknown} | string | ({[key: string]: unknown} | string)[])[]} definitionParts
 */
export function tokens(...definitionParts) {

	const tokenSet = new Set()

	for (const part of definitionParts) {
		if (Array.isArray(part)) {
			part.forEach(definition => {
				addTokensFromDefinition(definition, tokenSet)
			})
		} else {
			addTokensFromDefinition(part, tokenSet)
		}
	}

	return [...tokenSet].join(' ')
}


/** @import {TwowayBinding} from './dynamic-fragment.js' */

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

	/** @type {Function?} */
	#effect = null

	/** @type {((fieldValue: TransformedType) => ValueType)?} */
	#toTransform = null

	/** @type {((stateValue: ValueType) => TransformedType)?} */
	#fromTransform = null

	/**
	 * @param {object} state
	 * @param {string | number | symbol} property
	 * @param {((value: TransformedType) => ValueType)?} [toTransform]
	 * @param {((value: ValueType) => TransformedType)?} [fromTransform]
	 */
	constructor(state, property, toTransform = null, fromTransform = null) {
		this.#stateContainer = state
		this.#property = property
		this.#toTransform = toTransform
		this.#fromTransform = fromTransform
	}

	/** @returns {TransformedType} */
	get() {
		const value = this.#stateContainer[this.#property]
		return this.#fromTransform ? this.#fromTransform(value) : value
	}

	/** @param {TransformedType} newValue */
	set(newValue) {
		this.#stateContainer[this.#property] = this.#toTransform ? this.#toTransform(newValue) : newValue
		this.#effect?.call(null, newValue)
	}

	/** @param {Function} effect */
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
 * @returns {Twoway<T[Key], TransformedType>}
 */
export function twoway(state, property, toTransform, fromTransform) {
	return new Twoway(state, property, toTransform, fromTransform)
}
