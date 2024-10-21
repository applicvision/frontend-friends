import { before, describe, it } from '@applicvision/js-toolbox/test'
import { html, innerHTML } from '../src/dynamic-fragment.js'
import expect from '@applicvision/js-toolbox/expect'
import { addTestContainer, property } from './helpers.js'

describe('Dynamic fragments', () => {

	/** @type {HTMLElement} */
	let testContainer

	before(() => testContainer = addTestContainer())

	it('only dynamic', () => {
		const fragment = html`${'test'}`

		fragment.mount(testContainer)

		expect(testContainer.textContent).to.equal('test')
	})

	it('Should create dynamic fragment', () => {
		const fragment = html`<div class="${'test'}">hello ${123}</div>`
		fragment.mount(testContainer)

		expect(testContainer.firstElementChild?.className).to.equal('test')
		expect(testContainer.firstElementChild?.tagName).to.equal('DIV')
		expect(testContainer.innerText).to.equal('hello 123')

		fragment.values = ['test2', 321]

		expect(testContainer.firstElementChild?.className).to.equal('test2')
		expect(testContainer.firstElementChild?.tagName).to.equal('DIV')
		expect(testContainer.innerText).to.equal('hello 321')
	})

	it('Attributes without quotes', () => {
		const fragment = html`<div class=${'test'}>hello ${123}</div>`
		fragment.mount(testContainer)

		expect(testContainer.firstElementChild?.className).to.equal('test')

		fragment.values = ['test2']

		expect(testContainer.firstElementChild?.className).to.equal('test2')
	})

	it('Attributes with fixed beginning', () => {
		const fragment = html`<div class="beforeclass ${'test'}">hello</div>`
		fragment.mount(testContainer)

		expect(testContainer.firstElementChild?.className).to.equal('beforeclass test')
		fragment.values = ['test2']

		expect(testContainer.firstElementChild?.className).to.equal('beforeclass test2')

	})
	it('Attributes with fixed end', () => {
		const fragment = html`<div class="${'test'} afterclass">hello</div>`
		fragment.mount(testContainer)

		expect(testContainer.firstElementChild?.className).to.equal('test afterclass')
		fragment.values = ['test2']

		expect(testContainer.firstElementChild?.className).to.equal('test2 afterclass')
	})

	it('Attributes with both fixed start and end', () => {
		const fragment = html`<div class="beforeclass ${'test'} afterclass">hello</div>`
		fragment.mount(testContainer)

		expect(testContainer.firstElementChild?.className).to.equal('beforeclass test afterclass')
		fragment.values = ['test2']

		expect(testContainer.firstElementChild?.className).to.equal('beforeclass test2 afterclass')
	})

	it('Attributes with both fixed start and end again', () => {
		const fragment = html`<a href="https://${'domain'}.test/welcome">hello</a>`
		fragment.mount(testContainer)

		const link = testContainer.querySelector('a')
		expect(link?.href).to.equal('https://domain.test/welcome')
		fragment.values = ['otherdomain']

		expect(link?.href).to.equal('https://otherdomain.test/welcome')
	})

	it('Attributes with extensions', () => {
		const fragment = html`<div class="${'first'} ${'second'}">hello</div>`
		fragment.mount(testContainer)

		const element = testContainer.firstElementChild
		expect(element?.className).to.equal('first second')
		fragment.values = ['first2', 'second']

		expect(element?.className).to.equal('first2 second')

		fragment.values = ['first2', 'second2']

		expect(element?.className).to.equal('first2 second2')

		fragment.values = ['first3', 'second3']
		expect(element?.className).to.equal('first3 second3')
	})

	it('Attributes with extension and fixed parts', () => {
		const fragment2 = html`<div class="a ${'1'} b ${'2'} c ${'3'} d">hello</div>`
		fragment2.mount(testContainer)
		const element2 = testContainer.firstElementChild
		expect(element2?.className).to.equal('a 1 b 2 c 3 d')

		fragment2.values = ['11', '22', '33']
		expect(element2?.className).to.equal('a 11 b 22 c 33 d')
	})

	it('boolean attributes', () => {
		const fragment = html`<div hidden=${true}>hello</div>`
		fragment.mount(testContainer)

		let theDiv = testContainer.querySelector('div')

		expect(theDiv?.hidden).to.be.true()
		fragment.values = [false]

		expect(theDiv?.hidden).to.be.false()
	})

	it('handling null value attributes', () => {
		const fragment = html`<div class=${null}>hello</div>`
		fragment.mount(testContainer)

		/** @type {HTMLDivElement} */
		// @ts-ignore
		let theDiv = testContainer.firstElementChild

		expect(theDiv.getAttribute('class')).to.equal('')
		fragment.values = ['the-class']

		expect(theDiv.className).to.equal('the-class')

		fragment.values = [null]

		expect(theDiv.className).to.equal('')
	})

	it('event handler', () => {
		let clicked = false
		const clickHandler = () => clicked = true
		const fragment = html`<button onclick=${clickHandler}>tryck</button>`
		fragment.mount(testContainer)

		testContainer.querySelector('button')?.click()

		expect(clicked).to.be.true()
	})

	it('event handler with set context', () => {
		let valueToCheck = ''
		let innerValueToCheck = ''
		const clickHandler = function () { valueToCheck = this.value }
		const innerClickHandler = function () { innerValueToCheck = this.value }

		const context = {
			value: 'it works'
		}

		const fragment = html`
			<button class="outer" onclick=${clickHandler}>tryck</button>
			<div>${html`
				<button class="nested" onclick=${innerClickHandler}>inner</button>
			`}
			</div>
		`

		fragment.mount(testContainer, context)

		// @ts-ignore
		testContainer.querySelector('button.outer')?.click()

		expect(valueToCheck).to.equal('it works')

		// @ts-ignore
		testContainer.querySelector('button.nested')?.click()

		expect(innerValueToCheck).to.equal('it works')
	})

	it('nested', () => {
		let cycle = 0
		const getChild = () => html`<div>inner:${cycle}</div>`

		const fragment = html`<div>outer:${0}${getChild()}outer:${cycle}</div>`

		fragment.mount(testContainer)

		expect(testContainer.textContent).to.equal('outer:0inner:0outer:0')

		cycle++
		fragment.values = [0, getChild(), cycle]

		expect(testContainer.textContent).to.equal('outer:0inner:1outer:1')
	})

	it('alternating nested', () => {

		let isOn = false
		let counter = 0

		/** @param {boolean} newState */
		function updateState(newState) {
			counter++
			isOn = newState
			fragment.values = [isOn ? onState() : offState()]
		}

		const offState = () => html`<button onclick=${() => updateState(true)}>on ${counter}</button>`
		const onState = () => html`<button onclick=${() => updateState(false)}>off ${counter}</button>`

		const fragment = html`<div>outer ${isOn ? onState() : offState()}</div>`

		fragment.mount(testContainer)

		expect(testContainer.textContent).to.equal('outer on 0')

		testContainer.querySelector('button')?.click()

		expect(testContainer.textContent).to.equal('outer off 1')

		testContainer.querySelector('button')?.click()

		expect(testContainer.textContent).to.equal('outer on 2')
	})

	it('list', () => {
		const list = [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }]

		const getLis = () => list.map((person, index) => html`<li>${person.name}</li>`)

		const fragment = html`<ul><li>Always here</li>${getLis()}</ul>`

		fragment.mount(testContainer)

		expect(testContainer.innerText).to.equal('Always here\nalpha\nbeta\ngamma')

		list[0].name = 'nytt namn'
		fragment.values = [getLis()]

		expect(testContainer.innerText).to.equal('Always here\nnytt namn\nbeta\ngamma')

		list.push({ name: 'extra' }, { name: 'extra igen' })
		fragment.values = [getLis()]

		expect(testContainer.innerText).to.equal('Always here\nnytt namn\nbeta\ngamma\nextra\nextra igen')

		list.shift()
		fragment.values = [getLis()]

		expect(testContainer.innerText).to.equal('Always here\nbeta\ngamma\nextra\nextra igen')
	})

	it('nested list', () => {
		const list = [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }]

		const nestedList = () => html`<ul><li>Always here</li>${list.map((person, index) => html`<li>${person.name}</li>`)}</ul>`

		const fragment = html`<h2>outer</h2>${list.at(-1)?.name}${nestedList()}`

		fragment.mount(testContainer)


		expect(testContainer.innerText).to.equal('outer\ngamma\nAlways here\nalpha\nbeta\ngamma')

		list[1].name = 'omega'
		fragment.values = [list.at(-1)?.name, nestedList()]

		expect(testContainer.innerText).to.equal('outer\ngamma\nAlways here\nalpha\nomega\ngamma')
	})

	it('list with alternative item state', () => {
		const list = [{ name: 'alpha', showDetailed: true }, { name: 'beta' }, { name: 'gamma' }]

		const getLis = () => list.map((person, index) => {
			if (person.showDetailed) {
				return html`<li>index: ${index} details:${person.name}</li>`
			}
			return html`<li>${person.name}</li>`
		})

		const fragment = html`<ul>${getLis()}</ul>`

		fragment.mount(testContainer)

		expect(testContainer.innerText).to.equal('index: 0 details:alpha\nbeta\ngamma')

		const fisrtLi = testContainer.querySelector('li')

		list[0].showDetailed = false
		fragment.values = [getLis()]

		expect(testContainer.innerText).to.equal('alpha\nbeta\ngamma')

		list[0].showDetailed = true
		fragment.values = [getLis()]

		expect(testContainer.innerText).to.equal('index: 0 details:alpha\nbeta\ngamma')

		expect(testContainer.querySelector('li')).to.equal(fisrtLi)

	})

	it('only text', () => {
		const fragment = html`hej`

		fragment.mount(testContainer)

		expect(testContainer.textContent).to.equal('hej')
	})

	it('with innerHTML', () => {

		const fragment = html`hej <div>${innerHTML('<span>hello <b>friend</b></span>')}</div>`

		fragment.mount(testContainer)

		expect(testContainer.textContent).to.equal('hej hello friend')

		const fragment2 = html`hej <div>${'<span>hello <b>friend</b></span>'}</div>`

		fragment2.mount(testContainer)

		expect(testContainer.textContent).to.equal('hej <span>hello <b>friend</b></span>')
	})

	it('try to inject with attributes', () => {

		const fragment2 = html`<div id="${'"><input placeholder="oops"><div id="'}">hej</div>`
		fragment2.mount(testContainer)

		expect(testContainer.firstElementChild?.innerHTML).to.equal('hej')
	})

	it('inline style', () => {
		const fragment2 = html`<q style="${`background: #F00; quotes: '"' '"';`}">quotation</q>`
		fragment2.mount(testContainer)
		// @ts-ignore
		const { backgroundColor, quotes } = getComputedStyle(testContainer.firstElementChild)

		expect(quotes).to.equal('"\\"" "\\""')
		expect(backgroundColor).to.equal('rgb(255, 0, 0)')
	})

	it('primitive types', () => {
		const fragment = html`test: ${false && 'here'}`
		fragment.mount(testContainer)
		expect(testContainer.textContent).to.equal('test: ')

		fragment.values = [true && 'here']
		expect(testContainer.textContent).to.equal('test: here')

		fragment.values = [0]
		expect(testContainer.textContent).to.equal('test: 0')

		fragment.values = [null]
		expect(testContainer.textContent).to.equal('test: ')

		fragment.values = [undefined]
		expect(testContainer.textContent).to.equal('test: ')
	})

	it('Properties', () => {
		const fragment = html`<details>${property('open', true)}<summary>Test</summary></details>`
		fragment.mount(testContainer)
		/** @type {HTMLDetailsElement} */
		// @ts-ignore
		const details = testContainer.firstElementChild
		expect(details.open).to.be.true

		fragment.values = [property('open', false)]
		expect(details.open).to.be.false
	})
})
