const attributeRegex = /(?<attribute>[a-zA-Z-]+)=((?<quotemark>["'])(?<prefix>[^"']*))?$/

const commentPrefix = 'dynamic-fragment'
const contentCommentPrefix = `${commentPrefix}:content:`
const arrayContentCommentPrefix = `${commentPrefix}:array:`
const arrayItemSeparatorCommentPrefix = `${commentPrefix}:array-item:`
const propertyCommentPrefix = `${commentPrefix}:property:`

const attributePrefix = 'data-reactive'

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
 *	{type: 'content', start: Comment, end: Comment, current?: DynamicFragment} |
 * 	{type: 'array', start: Comment, end: Comment, current: DynamicFragment[]} |
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

/** @param {Comment} itemStart */
function nodesInItem(itemStart) {
	const itemNodes = []
	/** @type {Node|null} */
	let next = itemStart
	while (next = next.nextSibling) {

		if (next instanceof Comment &&
			(next.textContent?.trim().startsWith(arrayContentCommentPrefix) ||
				next.textContent?.trim().startsWith(arrayItemSeparatorCommentPrefix) ||
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
 * @template {{[key: string]: any}} T 
 * @implements {TwowayBinding}
 **/
class Twoway {

	/** @type {T} */
	#stateContainer

	/** @type {keyof T} */
	#property

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
	}
}

/**
 * @template {{[key: string]: any}} T
 * @param {T} state
 * @param {keyof state} property
 * @return {TwowayBinding}
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
		} else if (newValue instanceof Array) {
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
		element.value = sharedState.get()
	}
}


/**
 * @param {Element|DocumentFragment|ShadowRoot|null} referenceElement
 * @param {Exclude<AttributeLocator, {type: 'attributeExtension'}>} locator
 */
function locateElement(referenceElement, locator) {
	const dataAttribute = `${attributePrefix}-${locator.attribute}`


	if (referenceElement instanceof HTMLElement &&
		referenceElement.getAttribute(dataAttribute) == locator.dataAttributeValue) {

		referenceElement.removeAttribute(dataAttribute)
		return referenceElement
	}
	const element = referenceElement?.querySelector(`[${dataAttribute}="${locator.dataAttributeValue}"]`)
	element?.removeAttribute(dataAttribute)

	return element
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

	/** @type {any} */
	#eventHandlerContext

	/**
	 * @param {TemplateStringsArray} strings
	 * @param  {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|null|undefined)[]} values
	 */
	constructor(strings, values) {
		this.strings = strings
		this.#values = values
	}

	copy() {
		return new DynamicFragment(this.strings, this.values)
	}

	getHtmlString(indexPathPrefix = '') {

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

			const attributeMatch = typeof part == 'string' && part.match(attributeRegex)

			if (attributeMatch) {
				/** @type {{attribute: string, quotemark: '"'|"'"|'', prefix: string}} */
				// @ts-ignore
				const { attribute, quotemark = '', prefix = '' } = attributeMatch.groups

				let suffix = ''
				if (quotemark) {
					const nextPart = strings[index + 1]
					const endOfQuote = nextPart.indexOf(quotemark)
					if (endOfQuote != -1) {
						suffix = nextPart.slice(0, endOfQuote)
					}
				}

				if (attribute == sharedStateAttributeName) {
					if (typeof value?.get != 'function' || typeof value?.set != 'function') {
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


			// TODO: merge array and dynamic content
			if (value instanceof Array) {
				htmlResult += `<!-- ${arrayContentCommentPrefix}${indexPathPrefix}${index} -->`
				value.forEach((dynamicFragment, arrayIndex) => {
					if (dynamicFragment instanceof DynamicFragment) {
						htmlResult += dynamicFragment.getHtmlString(indexPathPrefix + index + '-' + arrayIndex + '-')
						if (arrayIndex < value.length - 1) {
							htmlResult += `<!-- ${arrayItemSeparatorCommentPrefix}${indexPathPrefix}${index}:${arrayIndex + 1} -->`
						}
					} else {
						throw new Error('Array item must be declared with html')
					}
				})
				htmlResult += `<!-- ${arrayContentCommentPrefix}${indexPathPrefix}${index} -->`
				return
			}

			// insert a comment to track position to enter content
			htmlResult += `<!-- ${contentCommentPrefix}${indexPathPrefix}${index} -->`
			if (value instanceof DynamicFragment) {
				htmlResult += value.getHtmlString(indexPathPrefix + index + '-')
			} else if (value instanceof InnerHTML) {
				htmlResult += value.htmlString
			} else if (value || value === 0) {

				htmlResult += escapeHtml(value.toString())
			}
			htmlResult += `<!-- ${contentCommentPrefix}${indexPathPrefix}${index} -->`

		})
		htmlResult += strings[strings.length - 1]

		this.#attributeLocators = attributeLocators

		return htmlResult
	}

	/**
	 * @template {Element|null} SelfElementTemplate
	 * @param {SelfElementTemplate extends Element ? null : Element|ShadowRoot|DocumentFragment} container
	 * @param {SelfElementTemplate} selfElement
	 * @param {any=} eventHandlerContext
	 */
	#connectAttributes(container, selfElement, eventHandlerContext) {

		// first traverse children
		this.#dynamicNodes.forEach((node) => {
			if (node.type == 'array') {
				/** @type {Element} */
				// @ts-ignore (There should be an element for every item in the array)
				let currentElement = node.start.nextElementSibling
				for (const arrayNode of node.current) {

					arrayNode.#connectAttributes(null, currentElement, eventHandlerContext)
					// @ts-ignore (There should be an element for every item in the array)
					currentElement = currentElement.nextElementSibling
				}
			} else if (node.type == 'content' && node.current) {
				/** @type {Element|ShadowRoot|DocumentFragment} */
				// @ts-ignore
				const parent = node.start.parentNode
				node.current.#connectAttributes(parent, null, eventHandlerContext)
			}
		})

		this.#attributeLocators?.forEach(locator => {
			if (locator.type == 'attributeExtension') {
				this.#dynamicNodes[locator.index] = { type: 'attributeExtension', prefix: locator.prefix, suffix: locator.suffix, associatedIndex: locator.associatedIndex }
				return
			}

			const element = locateElement(selfElement ?? container, locator)

			if (!element) {
				console.log(selfElement ?? container, locator)
				throw new Error(`Could not connect attribute of type: ${locator.type}`)
			}

			if (locator.type == 'sharedState') {
				/** @type {TwowayBinding} */
				const binding = this.values[locator.index]

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
					throw new Error('Can not connect shared state')
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
					handler?.call(eventHandlerContext || element, event)
				})
			}
		})

		// this array is no longer needed
		this.#attributeLocators = null
	}

	/**
	 * @param {AttributeLocator} locator
	 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} element
	 * @param {Event} event
	 */
	#handleNativeInputEvent(locator, element, event) {
		/** @type {TwowayBinding} */
		const binding = this.values[locator.index]

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
	 * @param {any=} eventHandlerContext
	 */
	hydrate(container, eventHandlerContext) {
		if (!this.#attributeLocators) {
			// parse the html once to find attributes
			this.getHtmlString()
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
					return currentValue.values[Number(index)]
				}, this)

			const currentValue = dynamicFragment.values[dynamicNodeIndex]

			if (type == 'property' && currentNode.parentElement) {
				/** @type {PropertySetter} */
				const propertySetter = currentValue
				const element = currentNode.parentElement
				dynamicFragment.#dynamicNodes[dynamicNodeIndex] = { type: 'property', element }
				if (propertySetter.key in element) {
					// @ts-ignore
					element[propertySetter.key] = propertySetter.value
				} else {
					console.warn('Unknown property', propertySetter.key, ' for element', element)
				}
			}
			else if (type == 'array') {

				/** @type {Extract<DynamicNode, {type: 'array'}> | undefined} */
				// @ts-ignore
				const node = dynamicFragment.#dynamicNodes[dynamicNodeIndex]
				if (!node) {

					dynamicFragment.#dynamicNodes[dynamicNodeIndex] = {
						type: 'array',
						start: currentNode,
						// This is not really the end, but set it for now (prevents ts-warning)
						end: currentNode,
						current: currentValue
					}
					if (currentValue.length > 0) {
						currentValue[0].#nodes = nodesInItem(currentNode)
					}
				} else {
					node.end = currentNode
				}
			} else if (type == 'array-item') {
				const index = Number(arrayIndex)
				/** @type {Extract<DynamicNode, {type: 'array'}>} */
				// @ts-ignore
				const node = dynamicFragment.#dynamicNodes[dynamicNodeIndex]
				node.current[index].#nodes = nodesInItem(currentNode)
				currentNode.remove()
			} else {
				/** @type {Extract<DynamicNode, {type: 'content'}> | undefined} */
				// @ts-ignore
				const node = dynamicFragment.#dynamicNodes[dynamicNodeIndex]
				if (!node) {
					dynamicFragment.#dynamicNodes[dynamicNodeIndex] = {
						type: 'content',
						start: currentNode,
						end: currentNode,
						current: currentValue instanceof DynamicFragment ? currentValue : undefined
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

		this.#connectAttributes(container, null, eventHandlerContext)

		this.#eventHandlerContext = eventHandlerContext
	}

	/** @type {Node[]?} */
	#nodes = null

	/**
	 * @param {HTMLElement|ShadowRoot} container 
	 * @param {any=} eventHandlerContext
	 **/
	mount(container, eventHandlerContext) {
		const htmlString = this.getHtmlString()
		container.innerHTML = htmlString
		this.hydrate(container, eventHandlerContext)
		this.#nodes = [...container.childNodes]
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
	#before(fragment) {
		if (!this.#nodes) throw new Error('Can not add something before an unmounted fragment')
		if (!fragment.#nodes) throw new Error('Can not before something thas has no nodes')

		const firstNode = this.#nodes[0]
		const parent = firstNode?.parentElement
		for (const node of fragment.#nodes) {
			parent?.insertBefore(node, firstNode)
		}
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
	 * @param {any=} eventHandlerContext
	 */
	#buildFragment(eventHandlerContext) {
		const template = document.createElement('template')
		template.innerHTML = this.getHtmlString()

		this.hydrate(template.content, eventHandlerContext)
		this.#nodes = [...template.content.childNodes]
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

		let newValue = (prefix + (newValues[index] ?? '') + suffix).trim()

		for (let node = this.#dynamicNodes[++index];
			node?.type == 'attributeExtension';
			node = this.#dynamicNodes[++index]) {
			newValue += node.prefix + (newValues[index] ?? '') + node.suffix.trimEnd()
		}

		if (attribute == 'value' && node instanceof HTMLInputElement) {
			node.value = newValue
		}

		node.setAttribute(attribute, newValue)
	}

	/** @param {any[]} newValues */
	set values(newValues) {
		const oldValues = this.values
		this.#values = newValues

		/** @type {Set<number>} */
		const updatedAttributes = new Set()

		newValues.forEach((value, index) => {
			const previousValue = oldValues[index]

			if (value == previousValue) {
				return
			}

			if (value instanceof InnerHTML && previousValue instanceof InnerHTML &&
				value.htmlString == previousValue.htmlString) {
				return
			}

			const dynamicNode = this.#dynamicNodes[index]

			switch (dynamicNode?.type) {
				case 'sharedState':
					if (elementIsNativeControlElement(dynamicNode.node)) {
						updateElementWithSharedState(dynamicNode.node, value)
					} else if (elementIsTwoWayBindable(dynamicNode.node)) {
						dynamicNode.node.sharedStateBinding = value
					}
					break
				case 'attribute':
					if (typeof value == 'boolean') {
						dynamicNode.node.toggleAttribute(dynamicNode.attribute, value)
					} else {
						this.#updateStringAttribute(index, newValues)
						updatedAttributes.add(index)
					}
					break
				case 'attributeExtension':
					if (!updatedAttributes.has(dynamicNode.associatedIndex)) {
						this.#updateStringAttribute(index, newValues)
						updatedAttributes.add(dynamicNode.associatedIndex)
					}
					break
				case 'property':
					/** @type {PropertySetter} */
					const { key, value: newValue } = value

					if (previousValue instanceof PropertySetter &&
						previousValue.key == key && previousValue.value == newValue
					) {
						console.log('skip update, nothing changed')
						return
					}
					// @ts-ignore
					dynamicNode.element[key] = newValue
					break;
				case 'content':
					if (value instanceof DynamicFragment && dynamicNode.current?.strings == value.strings) {
						// strings are the same. Just move the values
						dynamicNode.current.values = value.values
						break
					}
					const range = document.createRange()
					range.setStartAfter(dynamicNode.start)
					range.setEndBefore(dynamicNode.end)

					// Clear previous
					if (dynamicNode.current) {
						// store previous nested
						dynamicNode.current.#unmount()
						this.#cacheFragment(dynamicNode.current)
					} else {
						range.deleteContents()
					}

					if (value instanceof Array) {
						// TODO: This will be fixed when array and content are one type
						dynamicNode.type = 'array'
						dynamicNode.current = []
						this.#simpleListUpdate([], value, dynamicNode)
						return
					} else {
						this.#updateWithContent(value, dynamicNode)
					}
					break
				case 'array':

					if (!(value instanceof Array)) {
						// This clears existing elements
						this.#simpleListUpdate(previousValue, [], dynamicNode)

						// TODO: This is fixed when array and content are one type
						dynamicNode.type = 'content'
						this.#updateWithContent(value, dynamicNode)
						return
					}

					/** @type {DynamicFragment[]} */
					const nextArray = value

					/** @type {DynamicFragment[]} */
					const previousArray = previousValue

					if (nextArray.length && previousArray.length &&
						previousArray.every(fragment => fragment.#key) &&
						nextArray.every(fragment => fragment.#key)) {
						this.#keyedListUpdate(previousArray, nextArray, dynamicNode)
					} else {
						this.#simpleListUpdate(previousArray, nextArray, dynamicNode)
					}

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
				reusableFragment.restoreIn(range)
				// restore previous, and update its values
				dynamicNode.current = reusableFragment
				dynamicNode.current.values = value.values
				// remove it from the cache
				this.#fragmentCache.delete(value.strings)
			} else {
				range.insertNode(value.#buildFragment(this.#eventHandlerContext))
				dynamicNode.current = value
			}
		} else {

			delete dynamicNode.current
			if (value instanceof InnerHTML) {
				value.insertAfter(dynamicNode.start)
			} else {
				const textNode = new Text((value == null || value === false) ? '' : value.toString())
				range.insertNode(textNode)
			}
		}
	}

	/**
	 * @param {DynamicFragment[]} previousArray
	 * @param {DynamicFragment[]} nextArray
	 * @param {Extract<DynamicNode, {type: 'array'}>} dynamicNode
	 */
	#simpleListUpdate(previousArray, nextArray, dynamicNode) {

		// Remove and cache fragments when array is shorter
		if (previousArray.length > nextArray.length) {

			while (dynamicNode.current.length > nextArray.length) {

				const activeFragment = dynamicNode.current.pop()

				if (!activeFragment) throw new Error('Unexpected Error: Did not find active fragment to cache')

				activeFragment.#unmount()
				this.#cacheFragment(activeFragment)
			}

			// Insert new
		} else if (previousArray.length < nextArray.length) {

			const fragmentToInsert = document.createDocumentFragment()
			for (let index = previousArray.length; index < nextArray.length; index += 1) {
				const newFragment = nextArray[index]
				const cachedFragment = this.#getCached(newFragment)
				if (cachedFragment) {
					if (!cachedFragment.#nodes) throw new Error('no nodes found??')
					fragmentToInsert.append(...cachedFragment.#nodes)
					dynamicNode.current.push(cachedFragment)
					// and update its values, to update its contents
					cachedFragment.values = newFragment.values
				} else {
					fragmentToInsert.append(newFragment.#buildFragment(this.#eventHandlerContext))
					dynamicNode.current.push(newFragment)
				}

			}
			dynamicNode.end.parentNode?.insertBefore(fragmentToInsert, dynamicNode.end)
		}

		// Update the ones not touched by insertion/removal
		for (let index = 0; index < Math.min(previousArray.length, nextArray.length); index += 1) {
			const activeFragment = dynamicNode.current[index]
			const next = nextArray[index]

			// if (!nextNode) throw new Error('Array content is malformed. Document does not match data source.')

			if (activeFragment.strings == next.strings) {
				// strings are the same, update values
				activeFragment.values = next.values
			} else {
				// activeFragment.#unmount()
				this.#cacheFragment(activeFragment)

				const cachedFragment = this.#getCached(next)
				if (cachedFragment) {
					activeFragment.#replaceWith(cachedFragment)

					// and update its values, to update its contents
					cachedFragment.values = next.values
					dynamicNode.current[index] = cachedFragment
				} else {

					next.#buildFragment(this.#eventHandlerContext)
					activeFragment.#replaceWith(next)

					dynamicNode.current[index] = next
				}

			}
		}
	}

	/**
	 * @param {DynamicFragment[]} previousArray
	 * @param {DynamicFragment[]} nextArray
	 * @param {Extract<DynamicNode, {type: 'array'}>} dynamicNode
	 */
	#keyedListUpdate(previousArray, nextArray, dynamicNode) {
		let keysState = previousArray.map(fragment => fragment.#key)
		const nextKeys = nextArray.map(fragment => fragment.#key)


		let state = dynamicNode.current

		/** @type {Set<number>} */
		const usedItemIndices = new Set()

		/** @type {DynamicFragment?} */
		let currentFragment = null


		const mappedNext = nextArray.map((nextFragment, index) => {

			const previousIndex = dynamicNode.current.findIndex(currentFragment =>
				currentFragment.#key == nextFragment.#key &&
				currentFragment.strings == nextFragment.strings
			)

			/** @type {DynamicFragment} */
			let fragmentToAppend

			if (previousIndex != -1) {
				const previousFragment = dynamicNode.current[previousIndex]
				previousFragment.values = nextFragment.values
				usedItemIndices.add(previousIndex)
				if (index == previousIndex) {
					console.log('Item did not move in update, just move values')
					currentFragment = previousFragment
					return previousFragment
				}
				console.log('Reusable ietm found in array, but needs moving')
				fragmentToAppend = previousFragment

			} else {
				console.log('key', nextFragment.#key, 'not present in prev')
				const cachedFragment = this.#getCached(nextFragment)

				if (cachedFragment && nextFragment.#key) {
					console.log('restore from cache, move key and values')
					cachedFragment.key(nextFragment.#key)
					cachedFragment.values = nextFragment.values
					fragmentToAppend = cachedFragment
				} else {
					console.log('building new, most expensive')
					nextFragment.#buildFragment(this.#eventHandlerContext)
					fragmentToAppend = nextFragment
				}
			}

			if (currentFragment) {
				console.log('adding', fragmentToAppend.#key, 'after', currentFragment.#key)
				currentFragment.#after(fragmentToAppend)
			} else {
				console.log('No current fragment. Adding first item')
				dynamicNode.start.after(...fragmentToAppend.#nodes ?? [])
			}
			currentFragment = fragmentToAppend
			return fragmentToAppend
		})

		dynamicNode.current.forEach((fragment, index) => {
			if (!usedItemIndices.has(index)) {
				console.log('removing one')
				fragment.#unmount()
				this.#cacheFragment(fragment)
			}
		})

		// TODO: remove the current property, and use prev value
		dynamicNode.current = mappedNext

		return

		// console.log('update', keysState, nextKeys, state)

		console.log('before delete', state.map(fra => fra.#key))

		// Remove and cache the ones no longer present
		keysState = keysState.filter((key, index) => {
			if (!nextKeys.includes(key)) {
				console.log('an item was removed', key, index)
				// const fragmentToRemove = state[index]

				//TODO: Den här raden är fel!
				state.splice(index, 1)
				// previousKeys.splice(index, 1)
				fragmentToRemove.#unmount()
				this.#cacheFragment(fragmentToRemove)
				return false
			}
			return true
		})
		// state = state.filter(Boolean)
		console.log('before insert', state.map(fra => fra.#key))

		// Insert new ones
		nextKeys.forEach((key, index) => {
			if (!keysState.includes(key)) {
				console.log('a new key in the list')
				keysState.splice(index, 0, key)

				const newFragment = nextArray[index]
				const cachedFragment = this.#getCached(newFragment)
				/** @type {DynamicFragment} */
				let fragmentToInsert
				if (cachedFragment) {
					if (!cachedFragment.#nodes) {
						console.log('crashen', cachedFragment)
						throw new Error('no nodes found??')
					}
					// fragmentToInsert.append(...cachedFragment.#nodes)
					// dynamicNode.current.push(cachedFragment)
					// and update its values, to update its contents
					state.splice(index, 0, cachedFragment)
					// state[index + 1].#before(cachedFragment.#nodes)
					fragmentToInsert = cachedFragment
					cachedFragment.values = newFragment.values
				} else {
					newFragment.#buildFragment(this.#eventHandlerContext)
					// fragmentToInsert.append()
					// dynamicNode.current.push(newFragment)
					state.splice(index, 0, newFragment)
					fragmentToInsert = newFragment
				}
				const nextItem = state[index + 1]
				if (nextItem) {
					nextItem.#before(fragmentToInsert)
				} else {
					for (const node of fragmentToInsert.#nodes ?? []) {
						dynamicNode.end.parentNode?.insertBefore(node, dynamicNode.end)
					}
				}
				// state[index + 1].#before(fragmentToInsert)
			}
		})

		console.log('before moving', dynamicNode.current.map(fra => fra.#key))

		for (let index = 0; index < nextKeys.length; index++) {
			const key = nextKeys[index]
			const previousIndex = keysState.indexOf(key)
			if (index != previousIndex) {
				console.log('moving ', state[previousIndex].#nodes, 'to before', state[index])

				keysState.splice(index, 0, ...keysState.splice(previousIndex, 1))

				state[previousIndex].values = nextArray[index].values
				state[index].#before(state[previousIndex])
				state.splice(index, 0, ...state.splice(previousIndex, 1))

			} else {
				state[index].values = nextArray[index].values
			}
		}
		console.log('after moving', dynamicNode.current.map(fra => fra.#key))
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
		return this.getHtmlString()
	}
}
