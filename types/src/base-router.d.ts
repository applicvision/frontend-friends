import type { Prettify, UnionToIntersection } from "../type-utils.js"
import { DataShape } from "./parse-shape.js"
import { ResourceStore } from "./store.js"

export class BaseRouter<Routes> {
	mount(...args: any[]): any

	paramsFor<T extends keyof Routes>(path: T): Routes[T] extends { params: infer P } ? P : {}

	dataFor<T extends keyof Routes>(path: T): Routes[T] extends { data: infer P } ? P : {}

	linkTo<T extends keyof Routes & string>(path: T, ...params: keyof ExtractParams<T> extends never ?
		[] : [params: Prettify<ExtractParams<T>>]
	): string

	get query(): URLSearchParams

	static create<Spec extends RouterSpec<Spec>>(config: Spec): BaseRouter<AllRoutes<Spec>>
}

export type AllRoutes<Spec> = Prettify<UnionToIntersection<FlattenSpec<Spec>>>

type Children<T> = unknown extends T ? Record<string, unknown> : T extends { children?: infer C } ? NonNullable<C> : {}

export type RouteSpec<T, Path extends string = ''> = {
	layout?: string
	view?: string
	store?: ResourceStore<any>,
	load?: (
		get: <S>(shape: S, input: string | URL | Request, init?: RequestInit) => Promise<DataShape<S>>,
		params: Prettify<ExtractParams<Path>>,
		query: URLSearchParams
	) => Promise<any>
	children?: ChildrenSpec<Children<T>, Path>
}

type CurrentPath<Path extends string, K> =
	Path extends '' ? (K extends string ? K : '') : `${Path}/${K extends string ? K : ''}`

type ChildrenSpec<T, ParentPath extends string = ''> = {
	[K in keyof T]: RouteSpec<T[K], CurrentPath<ParentPath, K>>
}

type RouterSpec<T> = RouteSpec<T, ''>

type ExtractParams<Path extends string> = Path extends `${infer Segment}/${infer Rest}` ?
	(Segment extends `:${infer Param}` ? { [K in Param]: string } : {}) & ExtractParams<Rest>
	:
	Path extends `:${infer Param}` ? { [K in Param]: string } : {}


type FlattenSpec<Spec, Path extends string = ''> =
	{ [P in Path]: {
		data: Spec extends { load: (...args: any[]) => Promise<infer Data> } ? Data : undefined,
		params: ExtractParams<P>
	} }
	|

	(Spec extends { children: infer Children extends Record<string, any> } ?
		{
			[ChildPath in keyof Children & string]:
			FlattenSpec<Children[ChildPath], Path extends '' ? ChildPath : `${Path}/${ChildPath}`>

		}[keyof Children & string]
		: never)
