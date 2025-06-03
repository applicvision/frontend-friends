const attributeRegex = /(?<attribute>[a-zA-Z-]+)=((?<quotemark>["'])(?<prefix>[^"']*))?$/
const elementForAttributeRegex = /<(?<element>[a-zA-Z-]+)\s+([a-zA-Z-]+(=|(="[^"]*")|(='[^']*')|(=[^'"\s]+))?\s+)*$/

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
 * @typedef {Element & {sharedStateBinding: TwowayBinding|object}} CustomTwowayBindable
 * @typedef {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|CustomTwowayBindable} TwowayBindableElement
 */

// For backwards compatibility
export { twoway } from '@applicvision/frontend-friends/attribute-helpers'

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
 * @param {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|object|null|undefined)[]} values
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

/**
 * This is not really checking that items are strings. It is serving as a TS type assertion
 * @type {(value: unknown) => value is string[]}
 */
function isArrayOfStrings(value) {
	return Array.isArray(value)

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

/**
 * @param {unknown} binding
 * @param {unknown} newValue
 * @param {Event} event
 **/
function setToBindingOrThrow(binding, newValue, event) {
	if (!isTwowayBinding(binding)) throw new Error('Please use a two-way binding')

	return binding.set(newValue, event)
}

/**
 * @param {unknown} value
 **/
function getFromBinding(value) {
	return isTwowayBinding(value) ? value.get() : value
}
/**
 * @param {Comment} itemStart 
 * @param {string} itemIndexPath
 **/
function nodesInItem(itemStart, itemIndexPath) {

	const itemNodes = []
	/** @type {Node|null} */
	let next = itemStart
	while (next = next.nextSibling) {

		if (next instanceof Comment) {

			const commentText = next.textContent?.trim() ?? ''

			if (commentText == `${contentCommentPrefix}${itemIndexPath}` ||
				commentText.startsWith(`${arrayItemSeparatorCommentPrefix}${itemIndexPath}:`)
			) {
				break
			}
		}

		itemNodes.push(next)
	}
	if (!next) {
		console.warn('Unexpectedly reached end of child list without finding end of item', 'indexPath:', itemIndexPath)
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
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} element
 * @param {unknown} newValue
 **/
function updateNativeElement(element, newValue) {

	if (element instanceof HTMLSelectElement) {
		if (element.type == 'select-multiple') {

			if (!isArrayOfStrings(newValue)) {
				console.warn('Please use array with select type=select-multiple')
				return
			}
			for (const option of element.options) {
				option.selected = newValue.includes(option.value)
			}
			return
		}

		if (typeof newValue == 'string') {
			element.value = newValue
		} else {
			console.warn('Please use a string with single select')
		}

		return

	}
	if (element instanceof HTMLTextAreaElement) {
		if (typeof newValue != 'string') {
			console.warn('Please use strings with textarea')
		} else {
			element.value = newValue
		}
		return
	}

	switch (element.type) {
		case 'number':
		case 'range':
			if (typeof newValue != 'number') return console.warn('Please use numbers with input type=number or type=range')


			if (isNaN(newValue)) {
				if (!isNaN(element.valueAsNumber)) {
					element.value = ''
				}
			} else if (element.valueAsNumber != newValue) {
				element.valueAsNumber = newValue
			}

			break
		case 'datetime-local':
			if (newValue instanceof Date) {
				const dateString = `${newValue.toLocaleDateString('sv-SE')}T${newValue.toLocaleTimeString()}`
				element.value = dateString
			} else {
				element.value = String(newValue)
			}
			break
		case 'date':
		case 'month':
		case 'week':
			if (newValue instanceof Date) {
				element.valueAsDate = newValue
			} else {
				console.warn('Please use a Date as value for input type=date|month|week')
			}
			break
		case 'checkbox':
			if (typeof newValue == 'boolean') {
				element.checked = newValue
			} else if (newValue instanceof Set) {
				element.checked = newValue.has(element.name)
			} else if (Array.isArray(newValue)) {
				element.checked = newValue.includes(element.name)
			} else {
				console.warn('Unexpected type for checkbox input', newValue)
			}
			break
		case 'radio':
			element.checked = newValue == element.value
			break
		case 'text':
			if (typeof newValue != 'string') return console.warn('Unexpected type for input type=string', newValue)

			element.value = newValue
			break
		default:
			element.value = String(newValue)
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

	strings

	#values

	/** @type {unknown} */
	#eventHandlerContext

	/**
	 * @param {TemplateStringsArray} strings
	 * @param  {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|object|null|undefined)[]} values
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
			let part = strings.raw[index]

			if (part.lastIndexOf('<!--') > part.lastIndexOf('-->')) {
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

				// add the content up to the attribute
				htmlResult += part.slice(0, -attributeMatch[0].length)

				if (attribute == sharedStateAttributeName) {
					if (prefix || suffix) {
						throw new Error(`${sharedStateAttributeName} can not have prefix/suffix`)
					}
					if (!isTwowayBinding(value) && !(typeof value == 'object' && value != null)) {
						throw new Error(`${sharedStateAttributeName} must use a two way binding (get and set function), or a compatible object`)
					}

					const dataAttributeValue = indexPathPrefix + index

					htmlResult += `${attributePrefix}-${attribute}=${quotemark ?? ''}${dataAttributeValue}`
					attributeLocators[index] = { type: 'sharedState', attribute, index, dataAttributeValue }
					return
				}

				if (attribute.startsWith('on')) {
					if (typeof value != 'function') {
						throw new Error('Only functions are supported as event handlers')
					}
					if (prefix || suffix) {
						throw new Error('Event handler attributes can not have prefix/suffix')
					}
					const eventName = attribute.slice(2)

					const dataAttributeValue = indexPathPrefix + index

					htmlResult += `${attributePrefix}-${attribute}=${quotemark ?? ''}${dataAttributeValue}`
					attributeLocators[index] = { type: 'eventhandler', attribute, index, event: eventName, dataAttributeValue }
					return
				}


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

			const isArray = Array.isArray(value)

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

				if (!isTwowayBinding(binding) && !(typeof binding == 'object' && binding != null)) {
					throw new Error('Must use two way binding with sharedState')
				}


				if (elementIsNativeControlElement(element)) {
					element.addEventListener('input', (event) => this.#handleNativeInputEvent(locator, element, event))
					updateNativeElement(element, getFromBinding(binding))
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

		if (element instanceof HTMLSelectElement) {
			if (element.type == 'select-multiple') {
				if (isTwowayBinding(binding)) {
					const selected = []
					for (const option of element.selectedOptions) {
						selected.push(option.value)
					}
					binding.set(selected, event)
				} else if (isArrayOfStrings(binding)) {

					const selectedOptions = [...element.selectedOptions].map(option => option.value)
					// remove values no longer selected
					for (let index = binding.length - 1; index >= 0; index--) {
						if (!selectedOptions.includes(binding[index])) {
							binding.splice(index, 1)
						}
					}
					// add options previously not selected
					selectedOptions.forEach(option => {
						if (!binding.includes(option)) {
							binding.push(option)
						}
					})
				} else throw new Error('Invalid shared state binding')

			} else setToBindingOrThrow(binding, element.value, event)
			return
		}

		if (element instanceof HTMLTextAreaElement) {
			return setToBindingOrThrow(binding, element.value, event)
		}

		switch (element.type) {
			case 'checkbox':
				if (isTwowayBinding(binding)) { // Update the binding
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

				} else if (binding instanceof Set) {
					// mutate the set directly
					element.checked ? binding.add(element.name) : binding.delete(element.name)
				} else if (isArrayOfStrings(binding)) {
					if (element.checked && !binding.includes(element.name)) binding.push(element.name)

					if (!element.checked && binding.includes(element.name)) binding.splice(binding.indexOf(element.name), 1)

				} else throw new Error('Invalid state binding for checkbox')
				break
			case 'number':
			case 'range':
				return setToBindingOrThrow(binding, element.valueAsNumber, event)
			case 'datetime-local':
				const newValue = new Date(element.value)

				if (isTwowayBinding(binding)) {
					binding.set(newValue)
				} else if (binding instanceof Date) {
					const timestamp = newValue.getTime()
					if (timestamp)
						binding.setTime(timestamp)
					else
						console.warn('Invalid date value for datetime input')
				} else throw new Error('Invalid state binding for datetime-local input')
				break
			case 'date':
			case 'month':
			case 'week':
				if (isTwowayBinding(binding)) {
					binding.set(element.valueAsDate, event)
				} else if (binding instanceof Date) {
					const newDateValue = element.valueAsDate?.getTime()
					if (newDateValue) {
						binding.setTime(newDateValue)
					} else {
						console.warn('Invalid date value for date input')
					}
				} else throw new Error('Invalid state binding for Date input')
				break
			default:
				setToBindingOrThrow(binding, element.value, event)
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

			/** @type {[string, ('content'|'array-content'|'array-item'|'property'), string, string]} */
			// @ts-ignore
			const [_, type, indexPathString, arrayIndex] = currentNode.textContent?.trim().split(':') ?? ['', '', '', '']

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

				dynamicFragment.#dynamicNodes[dynamicNodeIndex] = {
					type: 'content',
					start: currentNode,
					// This is not really the end, but set it for now (prevents ts-warning)
					end: currentNode,
				}
				if (currentValue.length > 0) {
					currentValue[0].#nodes = nodesInItem(currentNode, indexPathString)
				}
			} else if (type == 'array-item' && Array.isArray(currentValue)) {

				currentValue[Number(arrayIndex)].#nodes = nodesInItem(currentNode, indexPathString)

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
						currentValue.#nodes = nodesInItem(currentNode, indexPathString)
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

					if (typeof value != 'object' || value == null) throw new Error('invalid value for shared state')

					if (elementIsNativeControlElement(dynamicNode.node)) {
						updateNativeElement(dynamicNode.node, getFromBinding(value))
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

							if (value.some((value, index) => value == previousValue[index])) {
								console.warn('Detected identical item in array. Please recreate dynamic fragments for every list rendering')
								return value
							}

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
