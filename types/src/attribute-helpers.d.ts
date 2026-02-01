export function style(declaration: Partial<CSSStyleDeclaration>): string

export function tokens(...parts: (
	{ [key: string]: unknown } |
	string |
	({ [key: string]: unknown } | string)[]
)[]): string
