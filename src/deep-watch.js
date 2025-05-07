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
		return setProxy(blueprint, (set) => modificationCallback(keyPath, set))
	}
	if (blueprint instanceof Date) {
		// @ts-ignore
		return new DateProxy(blueprint, value => modificationCallback(keyPath, value))
	}
	if (blueprint instanceof Map) {
		// @ts-ignore
		return mapProxy(blueprint, {
			didSet(key, newValue, oldValue) {
				modificationCallback(keyPath.concat(`Map[${key}]`), newValue, oldValue)
			},
			didDelete(key) {
				modificationCallback(keyPath.concat(`Map[${key}]`), null)
			},
			didClear(map) {
				modificationCallback(keyPath, map)
			},
			deepModification(innerKeyPath, newValue, oldValue) {
				modificationCallback(keyPath.concat(innerKeyPath), newValue, oldValue)
			}
		})
	}

	return new Proxy(blueprint, {
		get(target, property, reciever) {
			const value = Reflect.get(target, property, reciever)
			if (value && typeof value == 'object') {
				return recursiveWatch(value, modificationCallback, keyPath.concat(property))
			}
			return value
		},
		deleteProperty(target, property) {
			const oldValue = Reflect.get(target, property)
			const result = Reflect.deleteProperty(target, property)
			if (result) {
				modificationCallback(keyPath.concat(property), undefined, oldValue)
			}
			return result
		},
		set(target, property, newValue) {
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
 * @template T
 * @param {Set<T>} set
 * @param {(value: Set<T>) => void} callback
 */
function setProxy(set, callback) {
	return new Proxy(set, {
		get(target, property, reciever) {
			switch (property) {
				case 'size': return target.size
				case 'delete': return function proxyDelete(/** @type {T} */item) {
					const deleted = target.delete(item)
					if (deleted) {
						callback(target)
					}
					return deleted
				}
				case 'add':
					/** @param {T} item */
					return function proxyAdd(item) {
						target.add(item)
						callback(target)
						return target
					}
				case 'clear':
					return function proxyClear() {
						const returnValue = target.clear()
						callback(target)
						return returnValue
					}
				default:
					const value = Reflect.get(target, property, reciever)
					if (typeof value == 'function') {
						return value.bind(target)
					}
					return value
			}
		}
	})
}


/**
 * @template KeyType, ValueType
 * @param {Map<KeyType, ValueType>} map
 * @param {{
 * didSet?: (key: KeyType, newValue: ValueType, oldValue: ValueType|undefined) => void,
 * didDelete?: (key: KeyType) => void,
 * deepModification?: (keyPath: (string|symbol)[], newValue: unknown, oldValue: unknown) => void
 * didClear?: (map: Map<KeyType, ValueType>) => void }} handler
 */
function mapProxy(map, handler) {
	return new Proxy(map, {
		get(target, property, reciever) {
			switch (property) {
				case 'size': return target.size
				case 'delete':
					/** @param {KeyType} key */
					return function proxyDelete(key) {
						const deleted = target.delete(key)
						if (deleted) {
							handler.didDelete?.(key)
						}
						return deleted
					}
				case 'set':
					/**
					 * @param {KeyType} key
					 * @param {ValueType} value
					 */
					return function proxySet(key, value) {
						const oldValue = target.get(key)
						target.set(key, value)
						handler.didSet?.(key, value, oldValue)
						return target
					}
				case 'clear':
					return function proxyClear() {
						const returnValue = target.clear()
						handler.didClear?.(target)
						return returnValue
					}
				// Also intercept get to return proxies for object items
				case 'get':
					/** @param {KeyType} key */
					return function proxyGet(key) {
						const value = target.get(key)
						if (value && typeof value == 'object') {

							return recursiveWatch(value,
								(keyPath, newValue, oldValue) => handler?.deepModification?.(keyPath, newValue, oldValue),
								[`Map[${key}]`]
							)
						}
						return value
					}
				default:
					const value = Reflect.get(target, property, reciever)
					if (typeof value == 'function') {
						return value.bind(target)
					}
					return value
			}
		}
	})
}


class DateProxy extends Date {

	// We need a reference to the original Date since mutations should reflect on that instance
	#originalDate
	#modificationCallback
	/**
	 * @param {Date} originalDate
	 * @param {(value: Date) => void} modificationCallback
	*/
	constructor(originalDate, modificationCallback) {
		super(originalDate)
		this.#originalDate = originalDate
		this.#modificationCallback = modificationCallback
	}

	static {

		Object.getOwnPropertyNames(Date.prototype)
			.filter(name => name.startsWith('set'))
			.forEach(method => {
				// @ts-ignore
				this.prototype[method] = function (...args) {
					// @ts-ignore
					Date.prototype[method].apply(this, args)
					// @ts-ignore
					const returnValue = Date.prototype[method].apply(this.#originalDate, args)

					this.#modificationCallback(this.#originalDate)

					return returnValue
				}
			})
	}
}
