import { test, expect } from '@playwright/test'

/**
 * End-to-end tests for the router, using the example app in examples/library.
 * The app is started by the webServer config in playwright.config.js.
 */

const base = 'http://localhost:3002'

/** @param {import('@playwright/test').Page} page */
async function waitForHydration(page) {
	await page.waitForFunction(() => {
		const islands = [...document.querySelectorAll('ff-island')]
		return islands.length > 0 &&
			islands.every(island => /** @type {any} */ (island).isMounted)
	})
}

/**
 * Collects requests made by the page, after the initial page load.
 * @param {import('@playwright/test').Page} page
 */
function trackRequests(page) {
	/** @type {URL[]} */
	const requests = []
	page.on('request', request => requests.push(new URL(request.url())))
	return {
		get documents() {
			return requests.filter(url => url.origin == base && !url.pathname.startsWith('/_ff-router/') && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/lib'))
		},
		get views() {
			return requests.filter(url => url.pathname.includes('/_ff-router/view/'))
		},
		get api() {
			return requests.filter(url => url.pathname.startsWith('/api/'))
		},
		clear() {
			requests.length = 0
		}
	}
}

/** @param {import('@playwright/test').Page} page */
function mainNav(page) {
	return page.getByRole('navigation', { name: 'Main' })
}

/** @param {import('@playwright/test').Page} page */
function bookList(page) {
	return page.getByRole('list', { name: 'Book list' }).getByRole('listitem')
}

test.describe('Server side rendering', () => {

	test('renders the route with layouts and data', async ({ request }) => {
		const response = await request.get(`${base}/books/2`)
		expect(response.status()).toBe(200)
		expect(response.headers()['content-type']).toBe('text/html')

		const body = await response.text()

		// Root layout, books layout and the view are combined
		expect(body).toContain('<h1>Library</h1>')
		expect(body).toContain('<h2 id="books-heading">Books</h2>')
		expect(body).toContain('<ff-outlet owner="">')
		expect(body).toContain('<ff-outlet owner="books">')

		// The island is rendered with the loaded data, and marked as hydratable
		expect(body).toMatch(/<h3>.*Frankenstein.*<\/h3>/)
		expect(body).toContain('<ff-island src="islands/book-details.js" hydratable>')

		// The data is transferred to the client
		expect(body).toContain('<script id="ff-router-data" type="application/json">')
		expect(body).toContain('"/api/books/2"')

		// And the client router is loaded
		expect(body).toContain(`import {router} from '/_ff-router/resource/router.js'`)
	})

	test('passes query parameters to the load function', async ({ request }) => {
		const response = await request.get(`${base}/books?q=mary`)
		const body = await response.text()
		expect(body).toContain('Frankenstein')
		expect(body).not.toContain('Dracula')
		expect(body).toMatch(/<input [^>]*name="q"[^>]*value="?mary"?/)
	})

	test('sends views without island content for client side navigation', async ({ request }) => {
		const response = await request.get(`${base}/_ff-router/view/books?params={}&query=sort%3Dtitle&parent=books`)
		expect(response.status()).toBe(200)

		const { view, data } = await response.json()
		expect(view).toContain('<ff-island src="islands/book-list.js"></ff-island>')
		expect(view).not.toContain('hydratable')
		expect(data.map((/** @type {{title: string}} */ book) => book.title)).toEqual([
			'Dracula', 'Frankenstein', 'Middlemarch', 'Moby-Dick', 'Pride and Prejudice', 'The Count of Monte Cristo'
		])
	})

	test('responds with 404 for unknown routes', async ({ request }) => {
		const response = await request.get(`${base}/unknown`)
		expect(response.status()).toBe(404)
	})

	test('responds with 404 for unknown views', async ({ request }) => {
		const response = await request.get(`${base}/_ff-router/view/unknown?params={}`)
		expect(response.status()).toBe(404)
	})

	test('serves resources inside the app directory', async ({ request }) => {
		const response = await request.get(`${base}/_ff-router/resource/islands/book-list.js`)
		expect(response.status()).toBe(200)
		expect(response.headers()['content-type']).toBe('application/javascript')
	})

	test('does not serve resources outside the app directory', async ({ request }) => {
		// Resource paths are relative to the app directory, so server.js is not found
		const response = await request.get(`${base}/_ff-router/resource/server.js`)
		expect(response.status()).toBe(404)

		const traversal = await request.get(`${base}/_ff-router/resource/../server.js`)
		expect(traversal.status()).toBe(404)
	})

	test.describe('without JavaScript', () => {
		test.use({ javaScriptEnabled: false })

		test('the page is readable', async ({ page }) => {
			await page.goto(`${base}/books/1`)

			await expect(page.getByRole('heading', { name: 'Pride and Prejudice' })).toBeVisible()
			await expect(page.getByText('by Jane Austen, 1813')).toBeVisible()
		})

		test('links and forms work as ordinary navigation', async ({ page }) => {
			await page.goto(`${base}/books`)
			await expect(mainNav(page).getByRole('link', { name: 'Books' })).toHaveAttribute('aria-current', 'page')

			await page.getByRole('link', { name: 'Title' }).click()
			await expect(page).toHaveURL(`${base}/books?sort=title`)
			await expect(bookList(page).first()).toContainText('Dracula')

			await page.getByRole('searchbox', { name: 'Search books' }).fill('bram')
			await page.getByRole('button', { name: 'Search' }).click()

			await expect(page).toHaveURL(`${base}/books?q=bram&sort=title`)
			await expect(bookList(page)).toHaveCount(1)
			await expect(bookList(page)).toContainText('Dracula')

			await page.getByRole('link', { name: 'Dracula' }).click()
			await expect(page).toHaveURL(`${base}/books/6`)
			await expect(page.getByRole('heading', { name: 'Dracula' })).toBeVisible()
		})
	})
})

test.describe('Hydration', () => {

	test('islands become interactive', async ({ page }) => {
		await page.goto(`${base}/books`)
		await waitForHydration(page)

		const likeButton = page.getByRole('button', { name: 'Like Moby-Dick' })
		await likeButton.click()
		await expect(likeButton).toHaveAttribute('aria-pressed', 'true')
		await expect(likeButton).toHaveText('♥')
	})

	test('the server rendered elements are reused', async ({ page }) => {
		/** @type {() => void} */
		let loadRouter = () => { }
		const routerCanLoad = new Promise(resolve => loadRouter = () => resolve(undefined))

		// Hold back the client router, to be able to inspect the page before hydration
		await page.route('**/router/browser-router.js', async route => {
			await routerCanLoad
			await route.continue()
		})

		await page.goto(`${base}/books`, { waitUntil: 'commit' })

		const likeButton = page.getByRole('button', { name: 'Like Dracula' })
		await likeButton.evaluate(element => element.dataset.marker = 'server rendered')
		expect(await page.locator('ff-island').evaluateAll(
			islands => islands.some(island => /** @type {any} */(island).isMounted)
		)).toBe(false)
		await expect(page.locator('ff-island[hydratable]')).toHaveCount(3)

		loadRouter()
		await waitForHydration(page)
		await expect(page.locator('ff-island[hydratable]')).toHaveCount(0)

		await likeButton.click()
		await expect(likeButton).toHaveAttribute('aria-pressed', 'true')
		await expect(likeButton).toHaveAttribute('data-marker', 'server rendered')
	})

	test('the transferred data is used instead of fetching it again', async ({ page }) => {
		const requests = trackRequests(page)
		await page.goto(`${base}/books`)
		await waitForHydration(page)

		await expect(bookList(page)).toHaveCount(6)
		expect(requests.api).toHaveLength(0)
	})

	test('route state is correct after hydration', async ({ page }) => {
		await page.goto(`${base}/books?q=e&sort=title`)
		await waitForHydration(page)

		await expect(mainNav(page).getByRole('link', { name: 'Books' })).toHaveAttribute('aria-current', 'page')
		await expect(mainNav(page).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
		await expect(page.getByRole('searchbox', { name: 'Search books' })).toHaveValue('e')
		await expect(page.getByRole('navigation', { name: 'Sort by' }).getByRole('link', { name: 'Title' }))
			.toHaveAttribute('aria-current', 'true')

		await page.goto(`${base}/books/3`)
		await waitForHydration(page)

		const likeButton = page.getByRole('article').getByRole('button')
		await expect(likeButton).toHaveText('Like')
		await likeButton.click()
		await expect(likeButton).toHaveAttribute('aria-pressed', 'true')
		await expect(likeButton).toHaveText('Liked ♥')
	})
})

test.describe('Client side navigation', () => {

	test('navigates without reloading the document', async ({ page }) => {
		await page.goto(base)
		await waitForHydration(page)

		const requests = trackRequests(page)

		await mainNav(page).getByRole('link', { name: 'Books' }).click()

		await expect(page).toHaveURL(`${base}/books`)
		await expect(bookList(page)).toHaveCount(6)
		await expect(mainNav(page).getByRole('link', { name: 'Books' })).toHaveAttribute('aria-current', 'page')
		await expect(mainNav(page).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')

		expect(requests.documents).toHaveLength(0)
		expect(requests.views).toHaveLength(1)
		expect(requests.views[0].pathname).toBe('/_ff-router/view/books')
		expect(requests.views[0].searchParams.get('parent')).toBe('')
	})

	test('loads only the part of the page that changes', async ({ page }) => {
		await page.goto(`${base}/books`)
		await waitForHydration(page)

		// Mark the search field, to verify that the books layout is kept
		await page.getByRole('searchbox').evaluate(element => element.dataset.marker = 'kept')

		const requests = trackRequests(page)
		await page.getByRole('link', { name: 'Moby-Dick' }).click()

		await expect(page).toHaveURL(`${base}/books/4`)
		await expect(page.getByRole('heading', { name: 'Moby-Dick' })).toBeVisible()
		await expect(page.getByRole('searchbox')).toHaveAttribute('data-marker', 'kept')

		expect(requests.views).toHaveLength(1)
		expect(requests.views[0].pathname).toBe('/_ff-router/view/books/:id')
		expect(requests.views[0].searchParams.get('parent')).toBe('books')
		expect(JSON.parse(requests.views[0].searchParams.get('params') ?? '')).toEqual({ id: '4' })
	})

	test('loads layouts when entering a new section', async ({ page }) => {
		await page.goto(`${base}/about`)
		await waitForHydration(page)
		await expect(page.getByRole('heading', { name: 'About' })).toBeVisible()

		await page.evaluate(() => navigation.navigate('/books/5').finished)

		await expect(page.getByRole('heading', { name: 'Books' })).toBeVisible()
		await expect(page.getByRole('heading', { name: 'Middlemarch' })).toBeVisible()
		await expect(page.getByRole('heading', { name: 'About' })).toHaveCount(0)

		// The new islands are mounted
		await waitForHydration(page)
		await page.getByRole('button', { name: 'Like', exact: true }).click()
		await expect(page.getByRole('button', { name: 'Liked ♥' })).toBeVisible()
	})

	test('same route navigation only reloads data', async ({ page }) => {
		await page.goto(`${base}/books/1`)
		await waitForHydration(page)

		const requests = trackRequests(page)
		await page.evaluate(() => navigation.navigate('/books/2').finished)

		await expect(page).toHaveURL(`${base}/books/2`)
		await expect(page.getByRole('heading', { name: 'Frankenstein' })).toBeVisible()

		expect(requests.views).toHaveLength(0)
		expect(requests.api.map(url => url.pathname)).toEqual(['/api/books/2'])
	})

	test('sorting updates the query and the data', async ({ page }) => {
		await page.goto(`${base}/books`)
		await waitForHydration(page)
		await expect(bookList(page).first()).toContainText('Pride and Prejudice')

		const requests = trackRequests(page)
		const sortBy = page.getByRole('navigation', { name: 'Sort by' })
		await sortBy.getByRole('link', { name: 'Title' }).click()

		await expect(page).toHaveURL(`${base}/books?sort=title`)
		await expect(bookList(page).first()).toContainText('Dracula')
		await expect(sortBy.getByRole('link', { name: 'Title' })).toHaveAttribute('aria-current', 'true')
		await expect(sortBy.getByRole('link', { name: 'Year' })).not.toHaveAttribute('aria-current')

		expect(requests.views).toHaveLength(0)
		expect(requests.api.map(url => url.pathname + url.search)).toEqual(['/api/books?sort=title'])

		// The search keeps the sort order
		await page.getByRole('searchbox', { name: 'Search books' }).fill('e')
		await page.getByRole('button', { name: 'Search' }).click()
		await expect(page).toHaveURL(`${base}/books?q=e&sort=title`)
		await expect(bookList(page).first()).toContainText('Dracula')
	})

	test('search updates the query and the data', async ({ page }) => {
		await page.goto(`${base}/books`)
		await waitForHydration(page)

		const requests = trackRequests(page)

		await page.getByRole('searchbox', { name: 'Search books' }).fill('mary')
		await page.getByRole('button', { name: 'Search' }).click()

		await expect(page).toHaveURL(`${base}/books?q=mary`)
		await expect(bookList(page)).toHaveCount(1)
		await expect(bookList(page)).toContainText('Frankenstein')

		expect(requests.documents).toHaveLength(0)
		expect(requests.views).toHaveLength(0)
		expect(requests.api.map(url => url.pathname + url.search)).toEqual(['/api/books?q=mary'])

		await page.getByRole('searchbox', { name: 'Search books' }).fill('nothing matches this')
		await page.getByRole('button', { name: 'Search' }).click()
		await expect(page.getByText('No books found.')).toBeVisible()

		await page.goBack()
		await expect(page).toHaveURL(`${base}/books?q=mary`)
		await expect(bookList(page)).toHaveCount(1)
		await expect(page.getByRole('searchbox', { name: 'Search books' })).toHaveValue('mary')

		// Reloading renders the same result on the server
		await page.reload()
		await expect(bookList(page)).toHaveCount(1)
		await expect(page.getByRole('searchbox', { name: 'Search books' })).toHaveValue('mary')
	})
})

test.describe('History traversal', () => {

	test('going back restores the previous page without loading it again', async ({ page }) => {
		await page.goto(`${base}/books`)
		await waitForHydration(page)

		await page.getByRole('link', { name: 'Dracula' }).click()
		await expect(page.getByRole('heading', { name: 'Dracula' })).toBeVisible()

		const requests = trackRequests(page)
		await page.goBack()

		await expect(page).toHaveURL(`${base}/books`)
		await expect(bookList(page)).toHaveCount(6)
		expect(requests.views).toHaveLength(0)
		expect(requests.api).toHaveLength(0)

		await page.goForward()
		await expect(page).toHaveURL(`${base}/books/6`)
		await expect(page.getByRole('heading', { name: 'Dracula' })).toBeVisible()
		expect(requests.views).toHaveLength(0)
	})

	test('the sort order is kept in the history', async ({ page }) => {
		await page.goto(`${base}/books`)
		await waitForHydration(page)

		await page.getByRole('link', { name: 'Title' }).click()
		await expect(bookList(page).first()).toContainText('Dracula')

		await mainNav(page).getByRole('link', { name: 'About' }).click()
		await expect(page.getByRole('heading', { name: 'About' })).toBeVisible()

		await page.goBack()
		await expect(page).toHaveURL(`${base}/books?sort=title`)
		await expect(bookList(page).first()).toContainText('Dracula')
		await expect(mainNav(page).getByRole('link', { name: 'Books' })).toHaveAttribute('aria-current', 'page')

		await page.goBack()
		await expect(page).toHaveURL(`${base}/books`)
		await expect(bookList(page).first()).toContainText('Pride and Prejudice')
	})
})

test.describe('Likes and the store', () => {

	test('likes are saved on the server', async ({ page }) => {
		await page.goto(`${base}/books`)
		await waitForHydration(page)

		await page.getByRole('button', { name: 'Like Moby-Dick' }).click()
		await expect(page.getByRole('button', { name: 'Like Moby-Dick' })).toHaveAttribute('aria-pressed', 'true')

		await page.reload()
		await expect(page.getByRole('button', { name: 'Like Moby-Dick' })).toHaveAttribute('aria-pressed', 'true')
		await expect(page.getByRole('button', { name: 'Like Dracula' })).toHaveAttribute('aria-pressed', 'false')
	})

	test('changes in the store are reflected in other views', async ({ page }) => {
		await page.goto(`${base}/books`)
		await waitForHydration(page)

		await expect(bookList(page).filter({ hasText: 'Middlemarch' })).not.toContainText('♥')

		await page.getByRole('link', { name: 'Middlemarch' }).click()
		await expect(page.getByRole('heading', { name: 'Middlemarch' })).toBeVisible()
		await page.getByRole('button', { name: 'Like', exact: true }).click()
		await expect(page.getByRole('button', { name: 'Liked ♥' })).toHaveAttribute('aria-pressed', 'true')

		await page.getByRole('link', { name: 'All books' }).click()
		await expect(bookList(page).filter({ hasText: 'Middlemarch' })).toContainText('♥')

		await page.goBack()
		await expect(page.getByRole('button', { name: 'Liked ♥' })).toBeVisible()
	})

	test('likes are shown as favourites on the start page', async ({ page }) => {
		await page.goto(base)
		await waitForHydration(page)
		await expect(page.getByText('No favourites yet.')).toBeVisible()

		await mainNav(page).getByRole('link', { name: 'Books' }).click()
		await page.getByRole('button', { name: 'Like Frankenstein' }).click()
		await page.getByRole('button', { name: 'Like Dracula' }).click()

		await mainNav(page).getByRole('link', { name: 'Home' }).click()
		const favourites = page.getByRole('list', { name: 'Favourites' }).getByRole('listitem')
		await expect(favourites).toHaveText(['Frankenstein', 'Dracula'])

		await favourites.getByRole('link', { name: 'Dracula' }).click()
		await expect(page.getByRole('button', { name: 'Liked ♥' })).toHaveAttribute('aria-pressed', 'true')
		await page.getByRole('button', { name: 'Liked ♥' }).click()

		await page.goBack()
		await expect(favourites).toHaveText(['Frankenstein'])
	})

	test('likes are kept when other data is loaded', async ({ page }) => {
		await page.goto(`${base}/books/1`)
		await waitForHydration(page)

		await page.getByRole('button', { name: 'Like', exact: true }).click()
		await page.evaluate(() => navigation.navigate('/books/2').finished)
		await expect(page.getByRole('heading', { name: 'Frankenstein' })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Like', exact: true })).toHaveAttribute('aria-pressed', 'false')

		await page.goBack()
		await expect(page.getByRole('heading', { name: 'Pride and Prejudice' })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Liked ♥' })).toHaveAttribute('aria-pressed', 'true')
	})
})
