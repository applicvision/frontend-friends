
/** @import {DataShape} from '../types/src/parse-shape.js' */

/**
 * @template T
 */
class Optional {
	/**
	 * @param {T} type
	 */
	constructor(type) {
		this.type = type
	}
}

/**
 * @template T
 */
class Shape {
	/**
	 * @param {T} definition
	 */
	constructor(definition) {
		this.definition = definition
	}

	/**
	 * @param {any} data
	 */
	parse(data) {
		return parse(this.definition, data)
	}
}


/**
 * @template T
 * @param {T} definition
 */
export function shape(definition) {
	return new Shape(definition)
}

/**
 * @template T
 * @param {T} value
 */
export function optional(value) {
	return new Optional(value)
}


/**
 * @template {DataShape<any>} T
 * @param {T} shape
 * @param {any} data
 * @returns {DataShape<T>}
 */
export function parse(shape, data) {
	if (shape instanceof Optional) {
		if (data === undefined) {
			return undefined
		}
		shape = shape.type
	}
	if (shape == String || shape == Boolean || shape == Number) {
		if (data == null) {
			throw new ParseError(`Expected a ${shape.name.toLowerCase()}, but none was found`)
		}
		return shape(data)
	}
	if (shape == Date) {
		const date = new Date(data)

		if (isNaN(Number(date))) {
			throw new ParseError('Expected to be a valid date string, but got: ' + data)
		}
		return date
	}
	if (shape == URL) {
		return new URL(data)
	}
	if (Array.isArray(shape)) {
		if (!Array.isArray(data)) {
			throw new ParseError('Expected array got: ' + data)
		}
		return data.map((entry, index) => {
			try {
				return parse(shape[0], entry)
			} catch (error) {

				const parseError = /** @type {ParseError} */(error)
				const rethrown = new ParseError(parseError.message)
				rethrown.keyPath = [`[${index}]`, ...parseError.keyPath]
				throw rethrown
			}
		})
	}
	// consider this as constructor function
	if (typeof shape == 'function') {
		const instance = new shape()
		return Object.assign(instance, data)
	}
	if (typeof shape != 'object' || shape == null) {
		throw new ParseError('Unexpected shape ' + shape)
	}
	if (typeof data != 'object' || shape == null) {
		throw new ParseError('Unexpected data. Expected object, got: ' + data)
	}

	return Object.fromEntries(Object.entries(shape instanceof Optional ? shape.type : shape).map(
		([key, propertyShape]) => {
			try {
				return [key, parse(propertyShape, data[key])]
			} catch (error) {
				/** @type {ParseError} */
				const parseError = error
				const rethrown = new ParseError(parseError.message)
				rethrown.keyPath = [key, ...parseError.keyPath]
				throw rethrown
			}
		}
	))
}


class ParseError extends Error {
	/**
	 * @type {string[]}
	 */
	keyPath = []

	get cause() {
		return `${this.message} at ${this.keyPath.join('.').replaceAll('.[', '[')}`
	}
}

