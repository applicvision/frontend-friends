/**
 * @param {{[key: string]: unknown} | string} definition
 * @param {Set<string>} tokenSet
 */
function addTokensFromDefinition(definition, tokenSet) {
	if (!definition) return
	switch (typeof definition) {
		case 'string': return addTokensFromString(definition, tokenSet)
		case 'object':
			Object.entries(definition)
				.filter(([_, value]) => value)
				.forEach(([key]) => addTokensFromString(key, tokenSet))
	}
}

/**
 * @param {string} stringWithTokens
 * @param {Set<string>} tokenSet
 */
function addTokensFromString(stringWithTokens, tokenSet) {
	stringWithTokens.split(' ').filter(Boolean)
		.forEach(token => tokenSet.add(token))
}


/**
 * @param {({[key: string]: unknown} | string | ({[key: string]: unknown} | string)[])[]} definitionParts
 */
export function tokens(...definitionParts) {

	const tokenSet = new Set()

	for (const part of definitionParts) {
		if (Array.isArray(part)) {
			part.forEach(definition => {
				addTokensFromDefinition(definition, tokenSet)
			})
		} else {
			addTokensFromDefinition(part, tokenSet)
		}
	}

	return [...tokenSet].join(' ')
}

const CAP_REGEX = /[A-Z]/g
/** @param {string} pascalCase */
function convertToCSSCasing(pascalCase) {
	if (pascalCase.startsWith('webkit') || pascalCase.startsWith('moz')) {
		pascalCase = '-' + pascalCase
	}
	return pascalCase
		.replaceAll(CAP_REGEX, (char) => `-${char.toLowerCase()}`)
}

/** @param {{[key in keyof CSSStyleDeclaration]?: string|number|null|undefined|false}} declaration */
export function style(declaration) {
	return Object.entries(declaration)
		.filter(([_, value]) => value || value === 0)
		.map(([property, value]) => `${convertToCSSCasing(property)}: ${value}`)
		.join('; ')
}

