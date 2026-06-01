
export type StoreSubscriber = { storeChanged: (store: ResourceStore<any>, resourceId?: string) => void }

export type AutoSubscriber = StoreSubscriber & { subscriptions: Map<ResourceStore<any>, Set<string | symbol>> }

export type AnyStore = ResourceStore<any>

declare class ResourceStore<T extends { [key: string]: any }> {
	constructor(name: string)

	get(id: string): T

	subscribe(listener: StoreSubscriber, id?: string): void

	unsubscribeAll(listener: StoreSubscriber): void

	unsubscribe(listener: StoreSubscriber, id?: string): void

	update(id: string, updates: Partial<T>): T

	insert(...entries: T extends { id: string } ? (T[] | T[][]) : never): T[]

	upsert(...entries: T extends { id: string } ? (T[] | T[][]) : never): T[]

	insertWithId(id: string, newEntry: T): T

	delete(id: string): void

	getAll(): T[]

	clear(): void
}

type StoreType<T> = T extends abstract new (...args: any) => any ? InstanceType<T> : T

export function getStore<T extends { [key: string]: any }>(template: T): { [key in keyof T]: ResourceStore<StoreType<T[key]>> }

export function unsubscribe(store: ReturnType<typeof getStore>, listener: StoreSubscriber): void

export function autoSubscribe(subscriber: AutoSubscriber, callback: () => void): void

export function clearSubscriber(subscriber: AutoSubscriber): void

export function seedStore(store: { [key: string]: ResourceStore<any> }, data: any): void

export function clearStore(store: { [key: string]: ResourceStore<any> }): void

export function serialize<T extends {
	[key: string]: ResourceStore<any>;
}>(store: T): { [key in keyof T]: T[key] extends ResourceStore<infer Type> ? Type[] : never; }

export type { ResourceStore }
