import { describe, it } from 'node:test'
import assert from 'node:assert'
import { html } from '../src/dynamic-fragment.js'
import { island } from '@applicvision/frontend-friends'

describe('Server side rendering', () => {
	it('Should render a string', () => {
		const result = html`<h1>hejsan ${'name'}</h1>`.toString()
		assert.equal(result, '<h1>hejsan <!-- dynamic-fragment:content:0 -->name<!-- dynamic-fragment:content:0 --></h1>')
	})

	it('should render an island', () => {
		const test = island(() => html`test ${'name'}`)
		assert.equal(test.hydratable, 'test <!-- dynamic-fragment:content:0 -->name<!-- dynamic-fragment:content:0 -->')
	})
})
