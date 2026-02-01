/** @import {StoreSubscriber, AutoSubscriber} from '../types/src/store.js' */


/** @template {{[key: string]: any}} T */
class ResourceStore {
	/** @type {{[id: string]: T}} */
	#state = {}

	/** @type {{[id: string]: Set<StoreSubscriber>}} */
	#subscribers = {}

	/** @type {string} */
	#name

	/**
	 * @param {string} name
	 */
	constructor(name) {
		this.#name = name
	}

	/**
	 * @param {string} id
	 * @param {StoreSubscriber=} subscriber
	 */
	get(id, subscriber) {
		if (subscriber) {
			this.subscribe(id, subscriber)
		} else if (autoSubscriber) {
			this.subscribe(id, autoSubscriber)
			autoSubscriber.subscriptions.add(this)
		}
		return this.#state[id]
	}

	/**
	 * @param {string} id
	 * @param {StoreSubscriber} listener
	 */
	subscribe(id, listener) {
		(this.#subscribers[id] ??= new Set()).add(listener)
	}

	/** @param {StoreSubscriber} listener */
	unsubscribeAll(listener) {
		Object.keys(this.#subscribers).forEach(resourceId => this.unsubscribe(resourceId, listener))
	}

	/**
	 * @param {string} id
	 * @param {StoreSubscriber} listener
	 */
	unsubscribe(id, listener) {
		this.#subscribers[id]?.delete(listener)
	}

	/**
	 * @param {string} id
	 * @param {Partial<T>} updates
	 */
	update(id, updates) {
		const result = Object.assign(this.#state[id], updates)
		this.#subscribers[id]?.forEach(subscriber => subscriber.storeChanged(this))
		return result
	}

	/**
	 * @param {T extends {id: string} ? (T[] | T[][]) : never} entries
	 */
	insert(...entries) {
		return entries.flatMap(entry => {
			if (entry instanceof Array) {

				return entry.map(newEntry => this.insertWithId(newEntry.id,
					/** @type {T} */
					(/** @type {unknown} */ (newEntry))
				))
			}
			return this.insertWithId(entry.id,
				/** @type {T} */
				(/** @type {unknown} */ (entry))
			)
		})
	}

	/**
	 * @param {T extends {id: string} ? (T[] | T[][]) : never} entries
	 */
	upsert(...entries) {
		return entries.flatMap(entry => {
			if (entry instanceof Array) {
				return entry.map(newEntry =>
					this.#state[newEntry.id] ?
						this.update(newEntry.id, /** @type {T} */(/** @type {unknown} */(newEntry))) :
						this.insertWithId(newEntry.id, /** @type {T} */(/** @type {unknown} */(newEntry)))
				)
			}
			return this.#state[entry.id] ?
				this.update(entry.id, /** @type {T} */(/** @type {unknown} */(entry))) :
				this.insertWithId(entry.id, /** @type {T} */(/** @type {unknown} */(entry)))
		})
	}

	/**
	 * @param {string} id
	 * @param {T} newEntry
	 */
	insertWithId(id, newEntry) {
		if (!id) {
			throw new Error('missing id property')
		}
		if (this.#state[id]) {
			throw new Error(`Resource of type ${this.#name} with id ${id} already exists`)
		}
		const result = this.#state[id] = newEntry

		this.#subscribers[id]?.forEach(subscriber => subscriber.storeChanged(this))

		return result
	}

	/** @param {string} id */
	delete(id) {
		delete this.#state[id]
	}

	getAll() {
		return Object.values(this.#state)
	}

	clear() {
		this.#state = {}
		this.#subscribers = {}
	}
}

/**
 * @template {any} T
 * @typedef {T extends abstract new (...args: any) => any ? InstanceType<T> : T} StoreType
 */

/** 
 * @template {{[key: string]: any}} T
 * @param {T} template
 * @return {{[key in keyof T]: ResourceStore<StoreType<T[key]>>}}
 */
export function getStore(template) {
	// @ts-ignore
	return Object.fromEntries(Object.keys(template).map(resourceName => [
		resourceName,
		new ResourceStore(resourceName)
	]))
}

/**
 * @param {ReturnType<typeof getStore>} store
 * @param {StoreSubscriber} listener
 */
export function unsubscribe(store, listener) {
	Object.values(store).forEach(resourceStore => resourceStore.unsubscribeAll(listener))
}

/** @type {AutoSubscriber | null} */
let autoSubscriber = null


/**
 * @template T
 * @param {AutoSubscriber} subscriber
 * @param {() => T} callback
 */
export function autoSubscribe(subscriber, callback) {
	autoSubscriber = subscriber
	const returnValue = callback()
	autoSubscriber = null
	return returnValue
}

/**
 * @param {{[key:string]: ResourceStore<any>}} store
 * @param {any} data
 */
export function seedStore(store, data) {
	Object.entries(store).forEach(([type, resourceStore]) => {
		resourceStore.insert(data[type])
	})
}

/**
 * @param {{[key:string]: ResourceStore<any>}} store
 */
export function clearStore(store) {
	Object.values(store).forEach(resourceStore => resourceStore.clear())
}


/**
 * @template {{[key:string]: ResourceStore<any>}} T
 * @param {T} store
 * @returns {{[key in keyof T]: T[key] extends ResourceStore<infer Type> ? Type[] : never }}
 */
export function serialize(store) {
	// @ts-ignore
	return Object.fromEntries(
		Object.entries(store).map(
			([type, resourceStore]) => [type, resourceStore.getAll()]
		)
	)
}
