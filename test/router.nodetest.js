import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Router } from '@applicvision/frontend-friends/router'

function createRouter() {
	return Router.create({
		view: 'home.html',
		children: {
			about: { view: 'about.html' },
			books: {
				view: 'books.html',
				children: {
					':id': { view: 'book.html' },
					new: { view: 'new-book.html' }
				}
			}
		}
	})
}

describe('Router', () => {
	it('should flatten the route configuration', () => {
		const router = createRouter()
		assert.deepEqual(
			router.routes.map(route => route.path).sort(),
			['', 'about', 'books', 'books/:id', 'books/new']
		)
	})

	it('should put constant routes before parameter routes', () => {
		const router = createRouter()
		const bookRoutes = router.routeMap['books'].children.map(route => route.path)
		assert.deepEqual(bookRoutes, ['books/new', 'books/:id'])
	})

	it('should not accept empty routes', () => {
		assert.throws(() => Router.create({ view: 'a.html', children: { empty: {} } }), /Empty route: empty/)
	})

	it('should not accept spaces in paths', () => {
		assert.throws(() => Router.create({ view: 'a.html', children: { 'with space': { view: 'b.html' } } }))
	})

	it('should require mount before creating links', () => {
		const router = createRouter()
		assert.throws(() => router.linkTo('about'), /not mounted/)
	})

	it('should create links', () => {
		const router = createRouter()
		router.mount()
		assert.equal(router.linkTo(''), '/')
		assert.equal(router.linkTo('about'), '/about')
		assert.equal(router.linkTo('books/:id', { id: '12' }), '/books/12')
	})

	it('should create links with base path', () => {
		const router = createRouter()
		router.mount({ base: 'app/' })
		assert.equal(router.basePath, '/app')
		assert.equal(router.linkTo(''), '/app')
		assert.equal(router.linkTo('books/:id', { id: '12' }), '/app/books/12')
	})
})
