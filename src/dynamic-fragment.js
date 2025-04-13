const attributeRegex = /(?<attribute>[a-zA-Z-]+)=((?<quotemark>["'])(?<prefix>[^"']*))?$/
const elementForAttributeRegex = /<(?<element>[a-zA-Z-]+)\s+([a-zA-Z-]+(=|(="[^"]*")|(='[^']*'))?\s+)*$/

const commentPrefix = 'dynamic-fragment'
const contentCommentPrefix = `${commentPrefix}:content:`
const arrayContentCommentPrefix = `${commentPrefix}:array-content:`
const arrayItemSeparatorCommentPrefix = `${commentPrefix}:array-item:`
const propertyCommentPrefix = `${commentPrefix}:property:`

const attributePrefix = 'data-reactive'

// TODO: It would be nice if this were added as some kind of extension
const sharedStateAttributeName = 'ff-share'

/**
 * @typedef {{type: 'eventhandler', attribute: string, dataAttributeValue: string, index: number, event: string } |
 * {type: 'attributeExtension', index: number, associatedIndex: number, prefix: string, suffix: string, quotemark: '"'|"'"} |
 * {type: 'booleanAttribute', attribute: string, dataAttributeValue: string, index: number } |
 * {type: 'sharedState', attribute: typeof sharedStateAttributeName, dataAttributeValue: string, index: number } |
 * {type: 'attribute', attribute: string, dataAttributeValue: string, quotemark: '"'|"'"|'', index: number, prefix: string, suffix: string}} AttributeLocator
*/

/**
 * @typedef {{get: () => any, set: (newValue: any, event?: Event) => void}} TwowayBinding
 * @typedef {Element & {sharedStateBinding: TwowayBinding}} CustomTwowayBindable
 * @typedef {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|CustomTwowayBindable} TwowayBindableElement
 */

/**
 * @typedef {(
 *	{type: 'content', start: Comment, end: Comment} |
 * 	{type: 'property', element: HTMLElement} |
 * 	{type: 'sharedState', node: TwowayBindableElement} |
 * 	{type: 'eventhandler'} |
 * 	{type: 'attributeExtension', prefix: string, suffix: string, associatedIndex: number} |
 * 	{type: 'attribute', attribute: string, prefix?: string, suffix?: string, node: Element})} DynamicNode
 */

/**
 * @param {string} inputString
 */
function escapeHtml(inputString) {
	return escapeEntries.reduce(
		(string, [character, replacement]) => string.replaceAll(character, replacement),
		inputString
	)
}

const quoteEscape = {
	'"': '&quot;',
	"'": '&#39;'
}

const escapeCharacters = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;'
}
const escapeEntries = Object.entries(escapeCharacters)

/**
 * @param {TemplateStringsArray} strings
 * @param {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|null|undefined)[]} values
 */
export function html(strings, ...values) {
	return new DynamicFragment(strings, values)
}

html.key = (/** @type {string | number} */ key) =>
	/**
	* @param {TemplateStringsArray} strings
	* @param {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|null|undefined)[]} values
	*/
	(strings, ...values) => new DynamicFragment(strings, values).key(key)

/** @type {(element: Element) => element is CustomTwowayBindable} */
function elementIsTwoWayBindable(element) {
	while ((element = Object.getPrototypeOf(element)) && element != HTMLElement.prototype) {
		if (Object.getOwnPropertyDescriptor(element, 'sharedStateBinding')) {
			return true
		}
	}
	return false
}

/** @param {Element} element */
function elementIsNativeControlElement(element) {
	return element instanceof HTMLInputElement ||
		element instanceof HTMLSelectElement ||
		element instanceof HTMLTextAreaElement
}

/**
 * @type {(value: unknown) => value is TwowayBinding}
 */
function isTwowayBinding(value) {
	// @ts-ignore
	return typeof value?.get == 'function' && typeof value?.set == 'function'
}

/** @param {Comment} itemStart */
function nodesInItem(itemStart) {
	const itemNodes = []
	/** @type {Node|null} */
	let next = itemStart
	while (next = next.nextSibling) {

		if (next instanceof Comment &&
			(next.textContent?.trim().startsWith(arrayItemSeparatorCommentPrefix) ||
				next.textContent?.trim().startsWith(contentCommentPrefix)
			)

		) {
			break
		}
		itemNodes.push(next)
	}
	return itemNodes
}

class InnerHTML {

	/**
	 * @param {string} htmlString
	 */
	constructor(htmlString) {
		this.htmlString = htmlString
	}

	/**
	 * @param {Comment} node
	 */
	insertAfter(node) {
		const template = document.createElement('template')
		template.innerHTML = this.htmlString
		node.after(template.content)
	}
}

/**
 * @param {string} htmlString
 */
export function innerHTML(htmlString) {
	return new InnerHTML(htmlString)
}

export class PropertySetter {
	/** 
	 * @param {string} key 
	 * @param {any} value
	 **/
	constructor(key, value) {
		this.key = key
		this.value = value
	}
}

/** 
 * @template {object} T 
 * @implements {TwowayBinding}
 **/
class Twoway {

	/** @type {T} */
	#stateContainer

	/** @type {keyof T} */
	#property

	/** @type {Function?} */
	#effect = null

	/**
	 * @param {T} state
	 * @param {keyof T} property
	 */
	constructor(state, property) {
		this.#stateContainer = state
		this.#property = property
	}

	get() {
		return this.#stateContainer[this.#property]
	}
	/** @param {any} newValue */
	set(newValue) {
		this.#stateContainer[this.#property] = newValue
		this.#effect?.call(null, newValue)
	}

	/** @param {Function} effect */
	withEffect(effect) {
		this.#effect = effect
		return this
	}
}

/**
 * @template {object} T
 * @param {T} state
 * @param {keyof state} property
 */
export function twoway(state, property) {
	return new Twoway(state, property)
}

/**
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} element
 * @param {TwowayBinding} sharedState
 **/
function updateElementWithSharedState(element, sharedState) {
	// document.activeElement == element
	const newValue = sharedState.get()
	if (element instanceof HTMLInputElement && element.type == 'checkbox') {

		if (typeof newValue == 'boolean') {
			element.checked = newValue
		} else if (newValue instanceof Set) {
			element.checked = newValue.has(element.name)
		} else if (Array.isArray(newValue)) {
			element.checked = newValue.includes(element.name)
		}
	} else if (element instanceof HTMLInputElement && element.type == 'radio') {
		element.checked = newValue == element.value
	} else if (element instanceof HTMLSelectElement && element.type == 'select-multiple') {
		for (const option of element.options) {
			/** @type {Array<string>} */
			const selectedOptions = newValue
			option.selected = selectedOptions.includes(option.value)
		}
	} else {
		element.value = newValue
	}
}


export class DynamicFragment {

	/**
	 * @type {DynamicNode[]}
	 **/
	#dynamicNodes = []

	/**
	 * @type {null | AttributeLocator[]}
	 **/
	#attributeLocators = null

	/** @type {TemplateStringsArray} */
	strings

	/** @type {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|null|undefined)[]} */
	#values

	/** @type {unknown} */
	#eventHandlerContext

	/**
	 * @param {TemplateStringsArray} strings
	 * @param  {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|null|undefined)[]} values
	 */
	constructor(strings, values) {
		this.strings = strings
		this.#values = values
	}


	#getHtmlString(indexPathPrefix = '') {

		const { strings, values } = this

		let htmlResult = ''

		let insideComment = false

		/** @type {AttributeLocator[]} */
		const attributeLocators = []

		values.forEach((value, index) => {
			let part = strings[index]

			if (part.includes('<!--') && !part.includes('-->')) {
				htmlResult += part
				insideComment = true
				return
			}
			if (insideComment && part.includes('-->')) {
				const endOfComment = part.indexOf('-->') + 3
				htmlResult += part.slice(0, endOfComment)
				part = part.slice(endOfComment)
				insideComment = false
			}

			if (insideComment) {
				htmlResult += part
				return
			}

			if (value instanceof PropertySetter) {
				htmlResult += part
				htmlResult += `<!-- ${propertyCommentPrefix}${indexPathPrefix}${index} -->`
				return
			}

			const previousAttributeLocator = attributeLocators[index - 1]

			if ((previousAttributeLocator?.type == 'attributeExtension' || previousAttributeLocator?.type == 'attribute') && previousAttributeLocator.quotemark && !part.includes(previousAttributeLocator.quotemark)) {

				const nextPart = strings[index + 1]
				const endOfQuote = nextPart.indexOf(previousAttributeLocator.quotemark)

				const suffix = endOfQuote == -1 ? '' : nextPart.slice(0, endOfQuote)

				const associatedIndex = previousAttributeLocator.type == 'attributeExtension' ? previousAttributeLocator.associatedIndex : index - 1

				attributeLocators[index] = { type: 'attributeExtension', index, prefix: part, suffix, quotemark: previousAttributeLocator.quotemark, associatedIndex }

				htmlResult += part + escapeHtml(String(value ?? ''))

				return
			}

			/** @type {RegExpMatchArray & {groups: {attribute: string, quotemark: '"'|"'"|'', prefix: string}}|null} */
			// @ts-ignore
			const attributeMatch = typeof part == 'string' && part.match(attributeRegex)


			/** @type {string|undefined} */
			let elementForAttribute
			if (attributeMatch) {
				const precedingString = strings
					.slice(0, index + 1)
					.join('')
					.slice(0, -attributeMatch[0].length)

				/** @type {RegExpMatchArray & {groups: {element: string}}|null} */
				// @ts-ignore
				const result = precedingString.match(elementForAttributeRegex)
				elementForAttribute = result?.groups.element
			}

			if (attributeMatch && elementForAttribute) {
				const { quotemark = '', prefix = '' } = attributeMatch.groups
				const attribute = attributeMatch.groups.attribute.toLowerCase()

				let suffix = ''
				if (quotemark) {
					const nextPart = strings[index + 1]
					const endOfQuote = nextPart.indexOf(quotemark)
					if (endOfQuote != -1) {
						suffix = nextPart.slice(0, endOfQuote)
					}
				}

				if (attribute == sharedStateAttributeName) {
					if (!isTwowayBinding(value)) {
						throw new Error(`${sharedStateAttributeName} must use a two way binding (get and set function)`)
					}

					htmlResult += part.slice(0, -attributeMatch[0].length)

					const dataAttributeValue = indexPathPrefix + index

					htmlResult += `${attributePrefix}-${attribute}=${quotemark ?? ''}${dataAttributeValue}`
					attributeLocators[index] = { type: 'sharedState', attribute, index, dataAttributeValue }
					return
				}

				if (attribute.startsWith('on')) {
					if (typeof value != 'function') {
						throw new Error('Only functions are supported as event handlers')
					}
					const eventName = attribute.slice(2)
					htmlResult += part.slice(0, -attributeMatch[0].length)

					const dataAttributeValue = indexPathPrefix + index

					htmlResult += `${attributePrefix}-${attribute}=${quotemark ?? ''}${dataAttributeValue}`
					attributeLocators[index] = { type: 'eventhandler', attribute, index, event: eventName, dataAttributeValue }
					return
				}

				// add the content up to the attribute
				htmlResult += part.slice(0, -attributeMatch[0].length)

				if (typeof value == 'boolean') {
					if (prefix || suffix) {
						throw new Error('Boolean attributes can not have prefix/suffix')
					}
					if (quotemark) {
						console.warn('Unexpected quotemark for boolean attribute.')
					}
					if (value) {
						htmlResult += attribute
					}
					const dataAttributeValue = indexPathPrefix + index
					htmlResult += ` ${attributePrefix}-${attribute}=${quotemark || ''}${dataAttributeValue}`

					attributeLocators[index] = {
						type: 'booleanAttribute',
						index,
						attribute: attribute.toLowerCase(),
						dataAttributeValue
					}
				} else if (typeof value == 'number' || typeof value == 'string' || value == null) {
					if (value == null) {
						console.warn('Passed', value, 'to attribute', attribute)
					}
					const dataAttributeValue = indexPathPrefix + index
					htmlResult += `${attributePrefix}-${attribute}=${dataAttributeValue}`
					let attributeValue = prefix + escapeHtml(String(value ?? ''))
					if (quotemark) {
						attributeValue = attributeValue.replaceAll(quotemark, quoteEscape[quotemark])
					} else if (attributeValue == '') {
						attributeValue = '""'
					} else if (attributeValue.includes(' ')) {
						attributeValue = `"${attributeValue.replaceAll('"', quoteEscape['"'])}"`
					}
					htmlResult += ` ${attribute}=${quotemark}${attributeValue}`

					attributeLocators[index] = {
						type: 'attribute',
						attribute: attribute.toLowerCase(),
						quotemark,
						index,
						prefix,
						suffix,
						dataAttributeValue
					}
				} else {
					throw new Error(`Illegal attribute value: ${value}, type: ${typeof value}, constructor: ${value?.constructor?.name}`)
				}
				return
			}

			// Treat as dynamic content
			htmlResult += part

			const isArray = value instanceof Array

			// insert a comment to track position to enter content
			htmlResult += `<!-- ${isArray ? arrayContentCommentPrefix : contentCommentPrefix}${indexPathPrefix}${index} -->`

			if (isArray) {
				value.forEach((dynamicFragment, arrayIndex) => {
					if (dynamicFragment instanceof DynamicFragment) {
						htmlResult += dynamicFragment.#getHtmlString(indexPathPrefix + index + '-' + arrayIndex + '-')
						if (arrayIndex < value.length - 1) {
							htmlResult += `<!-- ${arrayItemSeparatorCommentPrefix}${indexPathPrefix}${index}:${arrayIndex + 1} -->`
						}
					} else {
						throw new Error('Array item must be declared with html')
					}
				})
			} else if (value instanceof DynamicFragment) {
				htmlResult += value.#getHtmlString(indexPathPrefix + index + '-')
			} else if (value instanceof InnerHTML) {
				htmlResult += value.htmlString
			} else if (value || value === 0) {
				htmlResult += escapeHtml(value.toString())
			} else {
				// falsy content (except 0), does not render anything
			}
			htmlResult += `<!-- ${contentCommentPrefix}${indexPathPrefix}${index} -->`

		})
		htmlResult += strings[strings.length - 1]

		this.#attributeLocators = attributeLocators

		return htmlResult
	}

	/**
	 * @param {unknown} eventHandlerContext
	 */
	#connectAttributes(eventHandlerContext) {

		// first traverse children
		this.#dynamicNodes.forEach((node, index) => {
			if (node.type == 'content') {

				const dynamicPart = this.values[index]

				if (Array.isArray(dynamicPart)) {
					for (const arrayNode of dynamicPart) {
						arrayNode.#connectAttributes(eventHandlerContext)
					}

				} else if (dynamicPart instanceof DynamicFragment) {

					dynamicPart.#connectAttributes(eventHandlerContext)
				}
			}
		})

		this.#attributeLocators?.forEach(locator => {
			if (locator.type == 'attributeExtension') {
				this.#dynamicNodes[locator.index] = { type: 'attributeExtension', prefix: locator.prefix, suffix: locator.suffix, associatedIndex: locator.associatedIndex }
				return
			}

			const element = this.#locateElement(locator)

			if (!element) {
				throw new Error(`Could not connect attribute of type: ${locator.type}`)
			}

			if (locator.type == 'sharedState') {
				const binding = this.values[locator.index]

				if (!isTwowayBinding(binding)) {
					throw new Error('Must use two way binding with sharedState')
				}


				if (elementIsNativeControlElement(element)) {
					element.addEventListener('input', (event) => this.#handleNativeInputEvent(locator, element, event))
					updateElementWithSharedState(element, binding)
				} else if (elementIsTwoWayBindable(element)) {
					element.sharedStateBinding = binding
				} else if (customElements.get(element.localName)) {
					// @ts-ignore since custom elements are not always connected here, we add a provisional property
					// and then the constructor can consume that
					element._provisionalStateBinding = binding
				} else {
					throw new Error(`Can not connect shared state. Unknown element: ${element.localName}. Is it registered?`)
				}

				// @ts-ignore
				this.#dynamicNodes[locator.index] = { type: 'sharedState', node: element }

			} else if (locator.type == 'attribute') {
				this.#dynamicNodes[locator.index] = { type: 'attribute', prefix: locator.prefix, suffix: locator.suffix, attribute: locator.attribute, node: element }
			} else if (locator.type == 'booleanAttribute') {
				this.#dynamicNodes[locator.index] = { type: 'attribute', attribute: locator.attribute, node: element }
			} else {
				this.#dynamicNodes[locator.index] = {
					type: 'eventhandler'
				}

				element.addEventListener(locator.event, (event) => {
					const handler = this.values[locator.index]

					if (typeof handler !== 'function') throw new Error('Must pass function as event handler')

					handler?.call(eventHandlerContext || element, event)
				})
			}
		})

		// this array is no longer needed
		this.#attributeLocators = null
	}

	/**
	 * @param {Exclude<AttributeLocator, {type: 'attributeExtension'}>} locator
	 */
	#locateElement(locator) {
		if (!this.#nodes) {
			throw new Error('Can not locate element when fragment is not mounted')
		}

		const dataAttribute = `${attributePrefix}-${locator.attribute}`

		/** @type {Element?} */
		let element = null

		const elementNodes = this.#nodes.filter(node => node instanceof HTMLElement)
		if (elementNodes.length == 1) {
			const onlyElement = elementNodes[0]
			element = onlyElement.getAttribute(dataAttribute) == locator.dataAttributeValue ?
				onlyElement : onlyElement.querySelector(`[${dataAttribute}="${locator.dataAttributeValue}"]`)
		} else {
			const parent = this.#nodes[0].parentNode
			element = parent?.querySelector(`[${dataAttribute}="${locator.dataAttributeValue}"]`) ?? null
		}
		element?.removeAttribute(dataAttribute)

		return element
	}

	/**
	 * @param {AttributeLocator} locator
	 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} element
	 * @param {Event} event
	 */
	#handleNativeInputEvent(locator, element, event) {

		const binding = this.values[locator.index]

		if (!isTwowayBinding(binding)) throw new Error('Invalid shared state binding')

		if (element instanceof HTMLInputElement && element.type == 'checkbox') {
			const valueBefore = binding.get()
			if (valueBefore instanceof Set) {
				const newSet = new Set(valueBefore)
				element.checked ?
					newSet.add(element.name) :
					newSet.delete(element.name)
				return binding.set(newSet, event)
			}
			if (valueBefore instanceof Array) {
				const indexBefore = valueBefore.indexOf(element.name)
				const newArrayValue = element.checked ?
					valueBefore.concat(element.name) :
					valueBefore.toSpliced(indexBefore, 1)
				return binding.set(newArrayValue, event)
			}
			binding.set(element.checked, event)
		} else if (element instanceof HTMLSelectElement && element.type == 'select-multiple') {
			const selected = []
			for (const option of element.selectedOptions) {
				selected.push(option.value)
			}
			binding.set(selected, event)
		} else {
			binding.set(element.value, event)
		}
	}

	/**
	 * @param {Element|DocumentFragment|ShadowRoot} container
	 * @param {unknown=} eventHandlerContext
	 */
	hydrate(container, eventHandlerContext) {
		this.#nodes = [...container.childNodes]
		if (!this.#attributeLocators) {
			// parse the html once to find attributes
			this.#getHtmlString()
		}

		const commentIterator = document.createNodeIterator(
			container,
			NodeFilter.SHOW_COMMENT,
			(comment) => comment
				.textContent?.trim()
				.startsWith(commentPrefix) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
		)

		/** @type {Comment | null} */
		let currentNode
		// @ts-ignore
		while ((currentNode = commentIterator.nextNode())) {

			const [_, type, indexPathString, arrayIndex] = currentNode.textContent?.split(':') ?? []

			const indexPath = indexPathString.split('-')
			const dynamicNodeIndex = Number(indexPath.pop())
			/** @type {DynamicFragment} */
			// @ts-ignore
			const dynamicFragment = indexPath.reduce(
				/** 
				 * @param {DynamicFragment | DynamicFragment[]} currentValue 
				 * @param {string} index
				 **/
				(currentValue, index) => {
					if (currentValue instanceof Array) {
						return currentValue[Number(index)]
					}
					const subFragment = currentValue.values[Number(index)]
					if (!(Array.isArray(subFragment) || subFragment instanceof DynamicFragment)) {
						throw new Error('Unexpected nesting')
					}
					return subFragment
				}, this)

			const currentValue = dynamicFragment.values[dynamicNodeIndex]

			if (type == 'property' && currentNode.parentElement && currentValue instanceof PropertySetter) {

				const element = currentNode.parentElement
				dynamicFragment.#dynamicNodes[dynamicNodeIndex] = { type: 'property', element }
				if (currentValue.key in element) {
					// @ts-ignore
					element[currentValue.key] = currentValue.value
				} else {
					console.warn('Unknown property', currentValue.key, ' for element', element)
				}
			}
			else if (type == 'array-content' && Array.isArray(currentValue)) {

				/** @type {Extract<DynamicNode, {type: 'content'}> | undefined} */
				// @ts-ignore
				const node = dynamicFragment.#dynamicNodes[dynamicNodeIndex]
				if (!node) {

					dynamicFragment.#dynamicNodes[dynamicNodeIndex] = {
						type: 'content',
						start: currentNode,
						// This is not really the end, but set it for now (prevents ts-warning)
						end: currentNode,
					}
					if (currentValue.length > 0) {
						currentValue[0].#nodes = nodesInItem(currentNode)
					}
				} else {
					node.end = currentNode
				}
			} else if (type == 'array-item' && Array.isArray(currentValue)) {
				const index = Number(arrayIndex)
				/** @type {Extract<DynamicNode, {type: 'content'}>} */
				// @ts-ignore
				const node = dynamicFragment.#dynamicNodes[dynamicNodeIndex]

				currentValue[index].#nodes = nodesInItem(currentNode)

				currentNode.remove()
			} else {
				/** @type {Extract<DynamicNode, {type: 'content'}> | undefined} */
				// @ts-ignore
				const node = dynamicFragment.#dynamicNodes[dynamicNodeIndex]
				if (!node) {
					dynamicFragment.#dynamicNodes[dynamicNodeIndex] = {
						type: 'content',
						start: currentNode,
						end: currentNode
					}
					if (currentValue instanceof DynamicFragment) {
						currentValue.#nodes = nodesInItem(currentNode)
					}
				} else {
					node.end = currentNode
				}
			}

			// clear the content of the comment. We just need the reference to it from here
			currentNode.textContent = ''
		}

		this.#connectAttributes(eventHandlerContext)

		this.#eventHandlerContext = eventHandlerContext
	}

	/** @type {Node[]?} */
	#nodes = null

	/**
	 * @param {HTMLElement|ShadowRoot} container 
	 * @param {unknown=} eventHandlerContext
	 **/
	mount(container, eventHandlerContext) {
		container.innerHTML = this.toString()
		this.hydrate(container, eventHandlerContext)
	}

	#unmount() {
		if (!this.#nodes) return
		const parent = this.#nodes[0]?.parentElement
		for (const node of this.#nodes) {
			parent?.removeChild(node)
		}
	}

	/** @param {DynamicFragment} fragment */
	#replaceWith(fragment) {
		if (!this.#nodes) throw new Error('Can not replace something that is not mounted')

		const parent = this.#nodes[0]?.parentElement
		if (!parent) throw new Error('No parent element found')

		const newNodes = fragment.#nodes
		if (!newNodes) throw new Error('Can not replace with something that has no nodes')

		this.#nodes.forEach((node, index, array) => {
			if (index == array.length - 1) {
				const newFragment = document.createDocumentFragment()
				newFragment.append(...newNodes)
				parent.replaceChild(newFragment, node)
			} else {
				parent.removeChild(node)
			}
		})
	}

	/** @param {DynamicFragment} fragment */
	#after(fragment) {
		if (!this.#nodes) throw new Error('Can not add something after an unmounted fragment')
		if (!fragment.#nodes) throw new Error('Can not add something that has no nodes')

		const lastNode = this.#nodes.at(-1)
		if (lastNode instanceof CharacterData || lastNode instanceof HTMLElement) {
			lastNode.after(...fragment.#nodes)
		} else {
			throw new Error(`Unexpected node type: ${lastNode}`)
		}
	}

	/**
	 * @param {unknown=} eventHandlerContext
	 */
	#buildFragment(eventHandlerContext) {
		const template = document.createElement('template')
		template.innerHTML = this.#getHtmlString()

		this.hydrate(template.content, eventHandlerContext)
		return template.content
	}

	/** 
	 * @param {number} index
	 * @param {any[]} newValues
	 **/
	#updateStringAttribute(index, newValues) {
		const originalNode = this.#dynamicNodes[index]

		if (originalNode.type == 'attributeExtension') {
			index = originalNode.associatedIndex
		}

		const attributeNode = this.#dynamicNodes[index]

		if (attributeNode.type != 'attribute') throw new Error('Unexpected update of attribute')

		const { node, attribute, prefix = '', suffix = '' } = attributeNode

		let newValue = prefix.trimStart() + (newValues[index] ?? '') + suffix

		for (let node = this.#dynamicNodes[++index];
			node?.type == 'attributeExtension';
			node = this.#dynamicNodes[++index]) {
			newValue += node.prefix + (newValues[index] ?? '') + node.suffix.trimEnd()
		}

		if (attribute == 'value' && node instanceof HTMLInputElement) {
			node.value = newValue
		} else {
			node.setAttribute(attribute, newValue)
		}
	}

	/**
	 * @param {Extract<DynamicNode, {type: 'attribute'}>} dynamicNode
	 * @param {boolean} newValue
	 */
	#updateBooleanAttribute({ attribute, node }, newValue) {
		// set property instead of updating attribute for native inputs
		if (node instanceof HTMLInputElement && attribute == 'checked') {
			node.checked = newValue
		} else {
			node.toggleAttribute(attribute, newValue)
		}

	}

	set values(newValues) {

		/** @type {Set<number>} */
		const updatedAttributes = new Set()

		this.#values = newValues.map((value, index) => {
			const previousValue = this.values[index]

			if (value == previousValue) {
				return value
			}

			if (value instanceof InnerHTML && previousValue instanceof InnerHTML &&
				value.htmlString == previousValue.htmlString) {
				return value
			}

			const dynamicNode = this.#dynamicNodes[index]

			switch (dynamicNode?.type) {
				case 'sharedState':

					if (!isTwowayBinding(value)) throw new Error('Muse use two way binding')

					if (elementIsNativeControlElement(dynamicNode.node)) {
						updateElementWithSharedState(dynamicNode.node, value)
					} else if (elementIsTwoWayBindable(dynamicNode.node)) {
						dynamicNode.node.sharedStateBinding = value
					}
					return value

				case 'attribute':
					if (typeof value == 'boolean') {
						this.#updateBooleanAttribute(dynamicNode, value)
					} else {
						this.#updateStringAttribute(index, newValues)
						updatedAttributes.add(index)
					}
					return value
				case 'attributeExtension':
					if (!updatedAttributes.has(dynamicNode.associatedIndex)) {
						this.#updateStringAttribute(index, newValues)
						updatedAttributes.add(dynamicNode.associatedIndex)
					}
					return value
				case 'property':

					if (!(value instanceof PropertySetter)) throw new Error('Expected instance of PropertyStter')

					const { key, value: newPropertyValue } = value

					if (!(previousValue instanceof PropertySetter) ||
						previousValue.key != key || previousValue.value != newPropertyValue
					) {
						// @ts-ignore
						dynamicNode.element[key] = newPropertyValue
					}
					return value
				case 'content':
					if (
						value instanceof DynamicFragment &&
						previousValue instanceof DynamicFragment &&
						previousValue.strings == value.strings) {
						// strings are the same. Just move the values
						previousValue.values = value.values

						// Keep the previous value since no replacement has been made
						return previousValue
					}
					const range = document.createRange()
					range.setStartAfter(dynamicNode.start)
					range.setEndBefore(dynamicNode.end)


					if (Array.isArray(previousValue)) {
						if (Array.isArray(value)) { // array => array


							if (value.length && previousValue.length &&
								previousValue.every(fragment => fragment.#key) &&
								value.every(fragment => fragment.#key)) {

								return this.#keyedListUpdate(previousValue, value, dynamicNode)
							}
							return this.#simpleListUpdate(previousValue, value, dynamicNode)
						}

						// array => simple content

						// Clear array content
						this.#simpleListUpdate(previousValue, [], dynamicNode)

						return this.#updateWithContent(value, dynamicNode)

					}

					if (previousValue instanceof DynamicFragment) {
						// store previous fragment
						previousValue.#unmount()
						this.#cacheFragment(previousValue)
					} else {
						range.deleteContents()
					}

					if (value instanceof Array) {
						return this.#simpleListUpdate([], value, dynamicNode)
					}

					return this.#updateWithContent(value, dynamicNode)

				default: return value
			}
		})
	}

	/**
	 * @param {any} value
	 * @param {Extract<DynamicNode, {type: 'content'}>} dynamicNode
	 */
	#updateWithContent(value, dynamicNode) {
		// TODO: Range is probably not needed when there are dom references
		const range = document.createRange()
		range.setStartAfter(dynamicNode.start)
		range.setEndBefore(dynamicNode.end)
		if (value instanceof DynamicFragment) {

			const reusableFragment = this.#getCached(value)
			if (reusableFragment) {
				// restore previous, and update its values
				reusableFragment.restoreIn(range)
				reusableFragment.values = value.values
				return reusableFragment
			}
			range.insertNode(value.#buildFragment(this.#eventHandlerContext))
			return value
		}

		if (value instanceof InnerHTML) {
			value.insertAfter(dynamicNode.start)
		} else {
			const textNode = new Text((value == null || value === false) ? '' : value.toString())
			range.insertNode(textNode)
		}
		return value
	}

	/**
	 * @param {DynamicFragment[]} previousArray
	 * @param {DynamicFragment[]} nextArray
	 * @param {Extract<DynamicNode, {type: 'content'}>} dynamicNode
	 */
	#simpleListUpdate(previousArray, nextArray, dynamicNode) {

		// Remove and cache fragments when array is shorter
		while (previousArray.length > nextArray.length) {

			const activeFragment = previousArray.pop()

			if (!activeFragment) throw new Error('Unexpected Error: Did not find active fragment to cache')

			activeFragment.#unmount()
			this.#cacheFragment(activeFragment)
		}

		const updatedExistingItems = previousArray.map((activeFragment, index) => {
			const newFragment = nextArray[index]

			if (activeFragment.strings == newFragment.strings) {
				// strings are the same, update values
				activeFragment.values = newFragment.values
				return activeFragment
			}

			this.#cacheFragment(activeFragment)

			const cachedFragment = this.#getCached(newFragment)
			if (cachedFragment) {
				activeFragment.#replaceWith(cachedFragment)

				cachedFragment.values = newFragment.values
				nextArray[index] = cachedFragment
				return cachedFragment

			}
			newFragment.#buildFragment(this.#eventHandlerContext)
			activeFragment.#replaceWith(newFragment)
			return newFragment
		})

		/** @type {DocumentFragment?} */
		let fragmentToInsert = null

		const newItems = nextArray.slice(previousArray.length).map((newFragment) => {
			const cachedFragment = this.#getCached(newFragment)
			fragmentToInsert ??= document.createDocumentFragment()
			if (cachedFragment) {
				if (!cachedFragment.#nodes) throw new Error('no nodes found??')

				fragmentToInsert.append(...cachedFragment.#nodes)

				// and update its values, to update its contents
				cachedFragment.values = newFragment.values

				return cachedFragment
			}
			fragmentToInsert.append(newFragment.#buildFragment(this.#eventHandlerContext))
			return newFragment
		})

		if (fragmentToInsert) {
			dynamicNode.end.before(fragmentToInsert)
		}

		return updatedExistingItems.concat(newItems)
	}

	/**
	 * @param {DynamicFragment[]} currentFragments
	 * @param {DynamicFragment[]} nextArray
	 * @param {Extract<DynamicNode, {type: 'content'}>} dynamicNode
	 */
	#keyedListUpdate(currentFragments, nextArray, dynamicNode) {

		/** @type {Map<number, number>} */
		const indexMapping = new Map()

		/** @type {DynamicFragment?} */
		let currentFragment = null

		for (let index = 0; index < currentFragments.length; index++) {
			const fragment = currentFragments[index]
			const nextIndex = nextArray.findIndex(nextFragment => nextFragment.#key == fragment.#key && nextFragment.strings == fragment.strings)
			if (nextIndex == -1) {
				fragment.#unmount()
				this.#cacheFragment(fragment)
				currentFragments.splice(index, 1)
				index -= 1
			} else {
				indexMapping.set(nextIndex, index)
			}
		}

		const mappedNext = nextArray.map((nextFragment, index) => {

			const previousIndex = indexMapping.get(index) ?? -1

			/** @type {DynamicFragment} */
			let fragmentToAppend

			if (previousIndex != -1) {
				const previousFragment = currentFragments[previousIndex]
				previousFragment.values = nextFragment.values
				if (index == previousIndex) {
					currentFragment = previousFragment
					return previousFragment
				}
				fragmentToAppend = previousFragment

			} else {
				const cachedFragment = this.#getCached(nextFragment)

				if (cachedFragment && nextFragment.#key) {
					cachedFragment.key(nextFragment.#key)
					cachedFragment.values = nextFragment.values
					fragmentToAppend = cachedFragment
				} else {
					nextFragment.#buildFragment(this.#eventHandlerContext)
					fragmentToAppend = nextFragment
				}
			}

			if (currentFragment) {
				currentFragment.#after(fragmentToAppend)
			} else {
				dynamicNode.start.after(...fragmentToAppend.#nodes ?? [])
			}
			currentFragment = fragmentToAppend
			return fragmentToAppend
		})

		return mappedNext
	}

	/** @type {string?} */
	#key = null

	/** @param {string|number} key */
	key(key) {
		this.#key = String(key)
		return this
	}

	/**
	 * @param {Range|HTMLElement|ShadowRoot} location
	 **/
	restoreIn(location) {

		if (!this.#nodes) throw new Error('No nodes to insert. Was this fragment ever mounted?')

		if (location instanceof Range) {
			const fragment = document.createDocumentFragment()
			fragment.append(...this.#nodes)
			location.insertNode(fragment)

		} else {
			location.replaceChildren(...this.#nodes)
		}
	}

	/** @type {Map<TemplateStringsArray, DynamicFragment[]>} */
	#fragmentCache = new Map()

	/** @param {DynamicFragment} fragment */
	#getCached(fragment) {
		return this.#fragmentCache.get(fragment.strings)?.pop()
	}

	/** @param {DynamicFragment} fragment */
	#cacheFragment(fragment) {
		let cacheArray = this.#fragmentCache.get(fragment.strings)
		if (!cacheArray) {
			cacheArray = []
			this.#fragmentCache.set(fragment.strings, cacheArray)
		}
		cacheArray.push(fragment)
	}

	get values() {
		return this.#values
	}

	toString() {
		return this.#getHtmlString()
	}
}
