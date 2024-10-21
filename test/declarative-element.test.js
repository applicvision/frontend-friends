import { before, describe, it } from '@applicvision/js-toolbox/test'
import expect from '@applicvision/js-toolbox/expect'
import { DeclarativeElement, css } from '../src/declarative-element.js'
import { html, innerHTML } from '../src/dynamic-fragment.js'
import { addTestContainer } from './helpers.js'


/** @param {HTMLElement} element */
function shadowText(element) {
	return element.shadowRoot?.textContent ?? ''
}

describe('Declarative Element component', () => {

	/** @type {HTMLElement} */
	let testContainer


	before(() => testContainer = addTestContainer())

	class ColorfulElement extends DeclarativeElement {
		static style = css`
			div {
				background: green;
				color: yellow;
			}
		`
		render() {
			return html`<div>colorful</div>`
		}
	}

	class Sanitizer extends DeclarativeElement {
		static observedAttributes = ['html']

		render() {
			const htmlcontent = this.getAttribute('html')
			return html`<div>${htmlcontent ? innerHTML(htmlcontent) : html`starten`}</div>`
		}
	}

	before(() => {
		customElements.define('test-styled', ColorfulElement)
		customElements.define('test-sanitizer', Sanitizer)
	})

	it('Should be styled', () => {
		const element = document.createElement('test-styled')
		testContainer.replaceChildren(element)
		expect(getComputedStyle(element.shadowRoot.firstElementChild).backgroundColor).to.equal('rgb(0, 128, 0)')
		expect(getComputedStyle(element.shadowRoot.firstElementChild).color).to.equal('rgb(255, 255, 0)')
	})

	it('testsomething', () => {
		const testelement = document.createElement('test-sanitizer')
		testContainer.replaceChildren(testelement)
		const h1 = document.createElement('h1')
		h1.textContent = 'nisse'
		testContainer.appendChild(h1)
		testelement.setAttribute('html', '<a href="asdasd"><h1>asdasdadsasd<h1>')
	})
})
