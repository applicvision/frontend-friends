export type DataShape<T> = T extends StringConstructor | NumberConstructor | BooleanConstructor ?
	ReturnType<T> :
	T extends abstract new (...args: any) => any ?
	InstanceType<T> :
	T extends Optional<infer Type> ?
	DataShape<Type> | undefined :
	T extends (infer Item)[] ?
	DataShape<Item>[] :
	T extends Object ?
	{ [key in keyof T]: DataShape<T[key]>; } :
	never

declare class Optional<T> {
	type: T
}


/**
 * Parses 'unknown' data using shape requirements.
*/
export function parse<T extends unknown>(shape: T, data: any): DataShape<T>

/**
 * Marks a value optional during parsing.
*/
export function optional<T>(value: T): Optional<T>

declare class Shape<T> {
	definition: T
	parse(data: any): ReturnType<typeof parse<T>>
}



/**
 * Creates a reusable parse instance, specifying the shape to parse.
 */
export function shape<T>(definition: T): Shape<T>
