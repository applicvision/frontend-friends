export type SpecialAttribute<ValueType, ElementType extends Element> = {
	isElementValid?: (element: Element) => element is ElementType,
	isValueValid?: (value: unknown) => value is ValueType
	connect?: (element: ElementType, getCurrentValue: () => ValueType) => void,
	update: (element: ElementType, value: ValueType, previousValue?: ValueType) => void,
}

type BaseAttributeDescriptor = { attribute: string, attributeStart: number, elementName: string, quotemark: '"' | "'" | '', prefix: string, suffix: string }

export type InterpolationDescriptor =
	BaseAttributeDescriptor & { type: 'attribute' } |
	BaseAttributeDescriptor & { type: 'specialAttribute' } |
	BaseAttributeDescriptor & { type: 'eventhandler' } |
	BaseAttributeDescriptor & { type: 'attributeExtension', quotemark: '"' | "'" } |
	{ type: 'content' }

export type AttributeLocator =
	{ type: 'eventhandler', attribute: string, dataAttributeValue: string, index: number, event: string } |
	{ type: 'attributeExtension', index: number, associatedIndex: number, prefix: string, suffix: string, quotemark: '"' | "'" } |
	{ type: 'booleanAttribute', attribute: string, dataAttributeValue: string, index: number } |
	{ type: 'specialAttribute', attribute: string, dataAttributeValue: string, index: number } |
	{ type: 'attribute', attribute: string, dataAttributeValue: string, quotemark: '"' | "'" | '', index: number, prefix: string, suffix: string }

export type DynamicNode =
	{ type: 'content', start: Comment, end: Comment } |
	{ type: 'property', element: HTMLElement } |
	{ type: 'eventhandler' } |
	{ type: 'attributeExtension', prefix: string, suffix: string, associatedIndex: number } |
	{ type: 'attribute', attribute: string, prefix?: string, suffix?: string, node: Element } |
	{ type: 'specialAttribute', attribute: string, node: Element }

export type PredicateType<T> = T extends (arg: any) => arg is infer Type ? Type : never

export type TwowayBinding = { get: () => any, set: (newValue: any, event?: Event) => void }

export type CustomTwowayBindable = Element & { sharedStateBinding: TwowayBinding | object }

export type TwowayBindableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | CustomTwowayBindable


export type KeyPath<T extends object> = T extends Map<any, any> ? [`Map[${string}]`] :
	T extends Set<any> | Date | URL | URLSearchParams ?
	[] :
	{ [K in keyof T]:
		[K, ...(T[K] extends object ? KeyPath<T[K]> : [])]
	}[keyof T]
