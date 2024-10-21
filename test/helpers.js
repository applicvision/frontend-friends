import { PropertySetter } from "../src/dynamic-fragment.js"

export function addTestContainer(id = 'elements-render-here') {
	let testContainer = document.getElementById(id)
	if (!testContainer) {
		testContainer = document.createElement('section')
		testContainer.id = 'elements-render-here'
		testContainer.style.position = 'fixed'
		testContainer.style.background = 'lightgray'
		testContainer.style.right = '10px'
		testContainer.style.top = '10px'
		testContainer.style.color = 'black'
		testContainer.style.padding = '10px'
		testContainer.style.height = '50%'
		testContainer.style.width = '30%'
		document.body.append(testContainer)
	}
	return testContainer
}


/**
 * @param {string} key
 * @param {any} value
 */
export function property(key, value) {
	return new PropertySetter(key, value)
}
