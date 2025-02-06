/**
 * @template {{[key: string|symbol]: any}} T
 * @param {T} blueprint
 * @param {(keypath: (string|symbol)[]) => void} modificationCallback
 * @param {(string|symbol)[]} keyPath
 * @returns {T}
 */
function recursiveWatch(blueprint, modificationCallback, keyPath = []) {
	// replace all properties which are object with new proxies
	for (var property in blueprint) {
		if (blueprint[property] && typeof blueprint[property] == 'object') {
			blueprint[property] = recursiveWatch(blueprint[property], modificationCallback, keyPath.concat(property))
		}
	}
	if (blueprint instanceof Set) {
		// @ts-ignore
		return new SetProxy(blueprint, {
			didAdd() {
				modificationCallback(keyPath)
			},
			didDelete() {
				modificationCallback(keyPath)
			},
			didClear() {
				modificationCallback(keyPath)
			},
			deepModification(innerKeyPath) {
				modificationCallback(keyPath.concat(innerKeyPath))
			}
		})
	}
	if (blueprint instanceof Map) {
		// @ts-ignore
		return new MapProxy(blueprint, {
			didSet(key) {
				modificationCallback(keyPath.concat(`Map[${key}]`))
			},
			didDelete(key) {
				modificationCallback(keyPath.concat(`Map[${key}]`))
			},
			didClear() {
				modificationCallback(keyPath)
			},
			deepModification(innerKeyPath) {
				modificationCallback(keyPath.concat(innerKeyPath))
			}
		})
	}
	return new Proxy(blueprint, {
		set(target, property, newValue) {
			if (typeof newValue == 'object') {
				// insert a new proxy
				newValue = recursiveWatch(newValue, modificationCallback, keyPath.concat(property))
			}
			const result = Reflect.set(target, property, newValue)
			modificationCallback(keyPath.concat(property))
			return result
		}
	})
}


/**
 * @template {{[key: string|symbol]: any}} T
 * @param {T} target
 * @param {(keypath: (string|symbol)[]) => void} modificationCallback
 * @returns {T}
 */
export function deepWatch(target, modificationCallback) {
	if (typeof target != 'object') {
		throw new Error('Can not watch non object. Supplied target was type: ' + typeof target)
	}
	return recursiveWatch(target, modificationCallback)
}

/**
 * Pass an object to deep watch. The `effect` function is called asynchronously on changes.
 * @template {{[key: string|symbol]: any}} T
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
	 * didSet?: (key: KeyType) => void,
	 * didDelete?: (key: KeyType) => void,
	 * deepModification?: (keyPath: (string|symbol)[]) => void
	 * didClear?: () => void }} [handler]
	 */
	constructor(template, handler) {
		/** @type {[KeyType, ValueType][]}*/
		const entries = [...template].map(([key, value]) => {
			if (typeof value == 'object') {
				/** @type {ValueType} */
				// @ts-ignore
				const proxiedValue = recursiveWatch(value, (keyPath) => this.handler?.deepModification?.(keyPath), [`Map[${key}]`])
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
		super.set(key, value)
		this.handler?.didSet?.(key)
		return this
	}

	/**
	 * @override
	 * @param {KeyType} key
	 */
	delete(key) {
		const result = super.delete(key)
		if (result) {
			this.handler?.didDelete?.(key)
		}
		return result
	}

	/** @override */
	clear() {
		super.clear()
		this.handler?.didClear?.()
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
	 * deepModification?: (keyPath: (string|symbol)[]) => void
	 * didClear?: () => void }} [handler]
	 */
	constructor(blueprint, handler) {
		/** @type {T[]} */
		const entries = [...blueprint].map(entry => {
			if (typeof entry == 'object') {

				/** @type {T} */
				// @ts-ignore
				const proxiedValue = recursiveWatch(entry, (keyPath) => this.handler?.deepModification?.(keyPath), ['[Set]'])
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
		this.handler?.didAdd?.(entry)
		return this
	}

	/**
	 * @override
	 * @param {T} entry
	 */
	delete(entry) {
		const result = super.delete(entry)
		if (result) {
			this.handler?.didDelete?.(entry)
		}
		return result
	}

	/**
	 * @override
	 */
	clear() {
		super.clear()
		this.handler?.didClear?.()
	}
}
