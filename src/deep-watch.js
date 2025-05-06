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

			didAdd(entry, set) {
				modificationCallback(keyPath, set)
			},

			didDelete(_, set) {
				modificationCallback(keyPath, set)
			},

			didClear(set) {
				modificationCallback(keyPath, set)
			},
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
 * @template KeyType, ValueType
 */
class MapProxy {

	#map

	#handler

	/**
	 * @param {Map<KeyType, ValueType>} map
	 * @param {{
	   * didSet?: (key: KeyType, newValue: ValueType, oldValue: ValueType|undefined) => void,
	   * didDelete?: (key: KeyType) => void,
	   * deepModification?: (keyPath: (string|symbol)[], newValue: unknown, oldValue: unknown) => void
	   * didClear?: () => void }} handler
	 */
	constructor(map, handler) {

		this.#map = map
		this.#handler = handler
	}

	/**
	 * @param {KeyType} key
	 */
	get(key) {
		const value = this.#map.get(key)
		if (value && typeof value == 'object') {

			return recursiveWatch(value,
				(keyPath, newValue, oldValue) => this.#handler?.deepModification?.call(this, keyPath, newValue, oldValue),
				[`Map[${key}]`]
			)
		}
		return value
	}

	/**
	 * @param {KeyType} key
	 * @param {ValueType} value
	 */
	set(key, value) {
		const oldValue = this.#map.get(key)
		this.#map.set(key, value)
		this.#handler?.didSet?.call(this, key, value, oldValue)
		return this
	}

	/**
	 * @param {KeyType} key
	 */
	delete(key) {
		const result = this.#map.delete(key)
		if (result) {
			this.#handler?.didDelete?.call(this, key)
		}
		return result
	}

	clear() {
		this.#map.clear()
		this.#handler?.didClear?.call(this)
	}

	static {
		const overriden = Object.getOwnPropertyNames(this.prototype)

		Object.entries(Object.getOwnPropertyDescriptors(Map.prototype))
			.filter(([name]) => !overriden.includes(name))
			.forEach(([name, descriptor]) => {
				const { get, value, ...rest } = descriptor
				/** @type {PropertyDescriptor} */
				const newDescriptor = {
					...rest
				}
				if (descriptor.get) {

					/** @this {MapProxy<any, any>} */
					const getter = function () {
						return descriptor.get?.apply(this.#map)
					}
					Object.defineProperty(getter, 'name', { value: descriptor.get.name, writable: false })
					newDescriptor.get = getter
				} else if (descriptor.value) {
					/**
					 * @this {MapProxy<any, any>}
					 * @param {unknown[]} args
					 **/
					const valueFunction = function (...args) {
						return descriptor.value.apply(this.#map, args)
					}
					Object.defineProperty(valueFunction, 'name', { value: descriptor.value.name, writable: false })
					newDescriptor.value = valueFunction

				}
				Object.defineProperty(this.prototype, name, newDescriptor)
			})
	}
}


/**
 * @template T
 */
class SetProxy {

	#set

	#handler

	/**
	 * @param {Set<T>} blueprint
	 * @param {{
	 * didAdd?: (entry: T, set: Set<T>) => void,
	 * didDelete?: (entry: T, set: Set<T>) => void,
	 * didClear?: (set: Set<T>) => void }} [handler]
	 */
	constructor(blueprint, handler) {
		this.#set = blueprint

		this.#handler = handler
	}

	/**
	 * @param {T} entry
	 */
	add(entry) {
		const returnValue = this.#set.add(entry)
		this.#handler?.didAdd?.(entry, this.#set)
		return returnValue
	}

	/**
	 * @param {T} entry
	 */
	delete(entry) {
		const result = this.#set.delete(entry)
		if (result) {
			this.#handler?.didDelete?.(entry, this.#set)
		}
		return result
	}

	clear() {
		this.#set.clear()
		this.#handler?.didClear?.(this.#set)
	}

	static {
		const overriden = Object.getOwnPropertyNames(this.prototype)

		Object.entries(Object.getOwnPropertyDescriptors(Set.prototype))
			.filter(([name]) => !overriden.includes(name))
			.forEach(([name, descriptor]) => {
				const { get, value, ...rest } = descriptor
				/** @type {PropertyDescriptor} */
				const newDescriptor = {
					...rest
				}
				if (descriptor.get) {

					/** @this {SetProxy<any>} */
					const getter = function () {
						return descriptor.get?.apply(this.#set)
					}
					Object.defineProperty(getter, 'name', { value: descriptor.get.name, writable: false })
					newDescriptor.get = getter
				} else if (descriptor.value) {
					/**
					 * @this {SetProxy<any>}
					 * @param {unknown[]} args
					 **/
					const valueFunction = function (...args) {
						return descriptor.value.apply(this.#set, args)
					}
					Object.defineProperty(valueFunction, 'name', { value: descriptor.value.name, writable: false })
					newDescriptor.value = valueFunction

				}
				Object.defineProperty(this.prototype, name, newDescriptor)
			})
	}
}

class DateProxy {

	#date
	#modificationCallback
	/**
	 * @param {Date} originalDate
	 * @param {(value: Date) => void} modificationCallback
	*/
	constructor(originalDate, modificationCallback) {
		this.#date = originalDate
		this.#modificationCallback = modificationCallback
	}

	static {

		Object.getOwnPropertyNames(Date.prototype)
			.filter(name => name != 'constructor')
			.forEach(method => {
				// @ts-ignore
				this.prototype[method] = function (...args) {
					// @ts-ignore
					const returnValue = Date.prototype[method].apply(this.#date, args)
					if (method.startsWith('set')) {
						this.#modificationCallback(this.#date)
					}
					return returnValue
				}
			})
	}
}
