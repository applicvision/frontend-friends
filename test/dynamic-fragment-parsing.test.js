import { before, describe, it } from '@applicvision/js-toolbox/test'
import expect from '@applicvision/js-toolbox/expect'
import { html } from '@applicvision/frontend-friends'
import { addTestContainer } from './helpers.js'

describe('Dynamic Fragment Parsing', () => {

	/** @type {HTMLElement} */
	let testContainer

	before(() => testContainer = addTestContainer())

	it('Should handle newlines in attributes', () => {
		const fragment = html`<div class="
			${'test'}
		">content</div>`
		fragment.mount(testContainer)

		expect(testContainer.firstElementChild?.className.trim()).to.equal('test')
	})

	it('content which looks like attributes', () => {
		const fragment = html`<div>attribute=${'value'}</div>`
		fragment.mount(testContainer)
		expect(testContainer.textContent).to.equal('attribute=value')

		const fragment2 = html`<div class="${'class'}">attribute=${'value'}</div>`
		fragment2.mount(testContainer)
		expect(testContainer.textContent).to.equal('attribute=value')


		expect(testContainer.querySelector('.class')).to.be.a(HTMLDivElement)

		const fragment3 = html`<div
				class="prefix ${'class'}" 
				role=dialog
				id=${'element_id'}
				>div attribute=${'value'}></div>`
		fragment3.mount(testContainer)
		const element = testContainer.querySelector('#element_id')

		expect(element?.role).to.equal('dialog')
		expect(element?.className).to.equal('prefix class')
		expect(element).to.equal(testContainer.querySelector('.class'))

		const fragment4 = html`<p
				data-content="test<a class='inner-content'>hello</a>"
				id='single-${'quote'}'
				disabled
				class=${'class'}
				>< test="${'value'}</p>`

		fragment4.mount(testContainer)

		expect(testContainer.textContent).to.equal('< test="value')
	})

	it('Should handle spacing in attributes', () => {
		const fragment = html`<div class = "${'test'}">content</div>`
		fragment.mount(testContainer)
		expect(testContainer.firstElementChild?.className).to.equal('test')
	})

	it('Should handle comment injection attempts', () => {
		const fragment = html`<div>${'-->'}</div>`
		fragment.mount(testContainer)
		expect(testContainer.textContent).to.equal('-->')

		const fragment2 = html`<div>${'<!--'}</div>`
		fragment2.mount(testContainer)
		expect(testContainer.textContent).to.equal('<!--')
	})

	it('Should handle > in attribute values', () => {
		const fragment = html`<div data-val="${'a > b'}">content</div>`
		fragment.mount(testContainer)
		expect(testContainer.firstElementChild?.getAttribute('data-val')).to.equal('a > b')
	})

	it('Should handle mixed quotes in attributes', () => {
		const fragment = html`<div data-val='${"it's ok"}'>content</div>`
		fragment.mount(testContainer)
		expect(testContainer.firstElementChild?.getAttribute('data-val')).to.equal("it's ok")
	})

	it('Should handle self-closing tags with tight spacing', () => {
		const fragment = html`<input value="${'test'}"/><div/>`
		fragment.mount(testContainer)
		const input = testContainer.querySelector('input')
		expect(input?.value).to.equal('test')
	})

	it('Should handle multiple dynamic parts in one attribute with newlines', () => {
		const fragment = html`<div class="
            ${'part1'}
            ${'part2'}
        "></div>`
		fragment.mount(testContainer)
		expect(testContainer.firstElementChild?.classList.contains('part1')).to.be.true()
		expect(testContainer.firstElementChild?.classList.contains('part2')).to.be.true()
	})


	it('Should handle newlines in attributes', () => {
		const fragment = html`<div class="
					${'test'}
				">content</div>`
		fragment.mount(testContainer)

		expect(testContainer.firstElementChild?.className.trim()).to.equal('test')
	})
})
