
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
 * @template T
 * @param {T} shape
 * @param {any} data
 * @returns {any}
 */
export function parse(shape, data) {
	if (shape instanceof Optional) {
		if (data === undefined) {
			return undefined
		}
		shape = shape.type
	}
	if (shape == String) {
		const type = typeof data
		if (type != 'string') {
			throw new ParseShapeError('Expected a string. But found ' + type)
		}
		return data
	}
	if (shape == Boolean) {
		const type = typeof data
		if (type != 'boolean') {
			throw new ParseShapeError('Expected a boolean. But found ' + type)
		}
		return data
	}
	if (shape == Number) {
		const type = typeof data
		if (type != 'number') {
			throw new ParseShapeError('Expected a number. But found ' + type)
		}
		return data
	}
	if (shape == Date) {
		const date = new Date(data)

		if (isNaN(Number(date))) {
			throw new ParseShapeError('Expected to be a valid date string, but got: ' + data)
		}
		return date
	}
	if (shape == URL) {
		try {
			return new URL(data)
		} catch (error) {
			throw new ParseShapeError('Expected a valid URL, but got: ' + data)
		}
	}
	if (Array.isArray(shape)) {
		if (!Array.isArray(data)) {
			throw new ParseShapeError('Expected array got: ' + data)
		}
		return data.map((entry, index) => {
			try {
				return parse(shape[0], entry)
			} catch (error) {
				if (error instanceof ParseShapeError) {
					error.keyPath.unshift(`[${index}]`)
				}
				throw error
			}
		})
	}
	// consider this as constructor function
	if (typeof shape == 'function') {
		/** @type {new (...args: any) => any} */
		const ShapeClass = /** @type {any}*/(shape)
		try {
			const instance = new ShapeClass(data)
			return Object.assign(instance, data)
		} catch (error) {
			throw new ParseShapeError('Failed to instantiate constructor: ' + (error instanceof Error ? error.message : String(error)))
		}
	}
	if (typeof shape != 'object' || shape == null) {
		throw new ParseShapeError('Unexpected shape ' + shape)
	}
	if (typeof data != 'object' || data == null) {
		throw new ParseShapeError('Unexpected data. Expected object, got: ' + data)
	}

	return Object.fromEntries(Object.entries(shape).map(
		([key, propertyShape]) => {
			try {
				return [key, parse(propertyShape, data[key])]
			} catch (error) {
				if (error instanceof ParseShapeError) {
					error.keyPath.unshift(key)
				}
				throw error
			}
		}
	))
}


class ParseShapeError extends Error {
	/**
	 * @type {string[]}
	 */
	keyPath = []
}

