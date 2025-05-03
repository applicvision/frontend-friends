/**
 * @template {{[key: string|symbol]: any}} T
 * @param {T} blueprint
 * @param {(keypath: (string|symbol)[], newValue: unknown, oldValue?: unknown) => void} modificationCallback
 * @param {(string|symbol)[]} keyPath
 * @returns {T}
 */
function recursiveWatch(blueprint, modificationCallback, keyPath = []) {

	if (blueprint instanceof Set) {
		// @ts-ignore
		return new SetProxy(blueprint, {
			/** @this {SetProxy<any>} */
			didAdd(entry) {
				modificationCallback(keyPath, this)
			},
			/** @this {SetProxy<any>} */
			didDelete() {
				modificationCallback(keyPath, this)
			},
			/** @this {SetProxy<any>} */
			didClear() {
				modificationCallback(keyPath, this)
			},
			deepModification(innerKeyPath, newValue, oldValue) {
				modificationCallback(keyPath.concat(innerKeyPath), newValue, oldValue)
			}
		})
	}
	if (blueprint instanceof Date) {
		// @ts-ignore
		return new DateProxy(blueprint, value => modificationCallback(keyPath, value))
	}
	if (blueprint instanceof Map) {
		// @ts-ignore
		return new MapProxy(blueprint, {
			didSet(key, newValue, oldValue) {
				modificationCallback(keyPath.concat(`Map[${key}]`), newValue, oldValue)
			},
			didDelete(key) {
				modificationCallback(keyPath.concat(`Map[${key}]`), null)
			},
			/** @this {MapProxy<any, any>} */
			didClear() {
				modificationCallback(keyPath, this)
			},
			deepModification(innerKeyPath, newValue, oldValue) {
				modificationCallback(keyPath.concat(innerKeyPath), newValue, oldValue)
			}
		})
	}

	let copy

	if (Array.isArray(blueprint)) {
		copy = blueprint.map((item, index) => {
			return item && typeof item == 'object' ?
				recursiveWatch(item, modificationCallback, keyPath.concat(String(index))) :
				item
		})
	} else {

		copy = Object.entries(blueprint).reduce(
			(copy, [key, value]) => {
				if (value && typeof value == 'object') {
					copy[key] = recursiveWatch(value, modificationCallback, keyPath.concat(key))
				} else {
					copy[key] = value
				}
				return copy
			}, Object.create(Object.getPrototypeOf(blueprint)))
	}

	return new Proxy(copy, {
		set(target, property, newValue) {
			if (newValue && typeof newValue == 'object') {
				// insert a new proxy
				newValue = recursiveWatch(newValue, modificationCallback, keyPath.concat(property))
			}
			const oldValue = Reflect.get(target, property)
			const result = Reflect.set(target, property, newValue)

			if (result) {
				modificationCallback(keyPath.concat(property), newValue, oldValue)
			}

			return result
		}
	})
}


/**
 * @template {{[key: string|symbol]: any}} T
 * @param {T} target
 * @param {(keypath: (string|symbol)[], newValue: unknown, oldValue?: unknown) => void} modificationCallback
 * @returns {T}
 */
export function deepWatch(target, modificationCallback) {
	if (!target) {
		throw new Error('Invalid target', target)
	}
	if (typeof target != 'object') {
		throw new Error('Can not watch non object. Supplied target was type: ' + typeof target)
	}
	return recursiveWatch(target, modificationCallback)
}

/**
 * Pass an object to deep watch. The `effect` function is called asynchronously on changes.
 * @template {object} T
 * @param {T} target
 * @param {(target: T) => void} effect
 * @returns {T}
 */
export function effect(target, effect) {
	/** @type {Promise<any>|null} */
	let effectPromise = null

	const watchedObject = deepWatch(target, () => {
		effectPromise ??= Promise.resolve().then(() => {
			effect(watchedObject)
			effectPromise = null
		})
	})

	return watchedObject
}


/**
 * @template KeyType, ValueType
 * @extends {Map<KeyType, ValueType>} 
 */
class MapProxy extends Map {
	/**
	 * @param {Map<KeyType, ValueType>} template
	 * @param {{
	 * didSet?: (key: KeyType, newValue: ValueType, oldValue: ValueType|undefined) => void,
	 * didDelete?: (key: KeyType) => void,
	 * deepModification?: (keyPath: (string|symbol)[], newValue: unknown, oldValue: unknown) => void
	 * didClear?: () => void }} [handler]
	 */
	constructor(template, handler) {
		/** @type {[KeyType, ValueType][]}*/
		const entries = [...template].map(([key, value]) => {
			if (value && typeof value == 'object') {
				/** @type {ValueType} */
				// @ts-ignore
				const proxiedValue = recursiveWatch(value,
					(keyPath, newValue, oldValue) => this.handler?.deepModification?.call(this, keyPath, newValue, oldValue),
					[`Map[${key}]`]
				)
				return [key, proxiedValue]
			}
			return [key, value]
		})

		super(entries)

		this.handler = handler
	}

	/**
	 * @override
	 * @param {KeyType} key
	 * @param {ValueType} value
	 */
	set(key, value) {
		const oldValue = this.get(key)
		super.set(key, value)
		this.handler?.didSet?.call(this, key, value, oldValue)
		return this
	}

	/**
	 * @override
	 * @param {KeyType} key
	 */
	delete(key) {
		const result = super.delete(key)
		if (result) {
			this.handler?.didDelete?.call(this, key)
		}
		return result
	}

	/** @override */
	clear() {
		super.clear()
		this.handler?.didClear?.call(this)
	}
}


/**
 * @template T
 * @extends {Set<T>}
 */
class SetProxy extends Set {
	/**
	 * @param {Set<T>} blueprint
	 * @param {{
	 * didAdd?: (entry: T) => void,
	 * didDelete?: (entry: T) => void,
	 * deepModification?: (keyPath: (string|symbol)[], newValue: unknown, oldValue: unknown) => void
	 * didClear?: () => void }} [handler]
	 */
	constructor(blueprint, handler) {
		/** @type {T[]} */
		const entries = [...blueprint].map(entry => {
			if (entry && typeof entry == 'object') {

				/** @type {T} */
				// @ts-ignore
				const proxiedValue = recursiveWatch(entry,
					(keyPath, newValue, oldValue) => this.handler?.deepModification?.call(this, keyPath, newValue, oldValue),
					['[Set]']
				)
				return proxiedValue
			}
			return entry
		})

		super(entries)

		this.handler = handler
	}

	/**
	 * @override
	 * @param {T} entry
	 */
	add(entry) {
		super.add(entry)
		this.handler?.didAdd?.call(this, entry)
		return this
	}

	/**
	 * @override
	 * @param {T} entry
	 */
	delete(entry) {
		const result = super.delete(entry)
		if (result) {
			this.handler?.didDelete?.call(this, entry)
		}
		return result
	}

	/**
	 * @override
	 */
	clear() {
		super.clear()
		this.handler?.didClear?.call(this)
	}
}

class DateProxy extends Date {

	#modificationCallback
	/**
	 * @param {Date} originalDate
	 * @param {(value: DateProxy) => void} modificationCallback
	*/
	constructor(originalDate, modificationCallback) {
		super(originalDate)
		this.#modificationCallback = modificationCallback
	}

	static {

		Object.getOwnPropertyNames(Date.prototype)
			.filter(name => name.startsWith('set'))
			.forEach(method => {
				// @ts-ignore
				this.prototype[method] = function (...args) {
					// @ts-ignore
					const returnValue = Date.prototype[method].apply(this, args)
					this.#modificationCallback(this)
					return returnValue
				}
			})
	}
}
