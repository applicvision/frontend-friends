import { randomUUID } from 'node:crypto'

/** @import {IncomingMessage, ServerResponse} from 'node:http' */

/** A tiny in-memory "database" for the example. */
const books = [
	{ id: '1', title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, summary: 'Elizabeth Bennet and Mr Darcy learn to see past first impressions.' },
	{ id: '2', title: 'Frankenstein', author: 'Mary Shelley', year: 1818, summary: 'A young scientist creates life, and has to live with the consequences.' },
	{ id: '3', title: 'The Count of Monte Cristo', author: 'Alexandre Dumas', year: 1844, summary: 'A wrongfully imprisoned sailor escapes and plans his revenge.' },
	{ id: '4', title: 'Moby-Dick', author: 'Herman Melville', year: 1851, summary: 'Captain Ahab hunts the white whale across the oceans.' },
	{ id: '5', title: 'Middlemarch', author: 'George Eliot', year: 1871, summary: 'The lives and ambitions of the people in a provincial English town.' },
	{ id: '6', title: 'Dracula', author: 'Bram Stoker', year: 1897, summary: 'A Transylvanian count travels to England, told through letters and diaries.' }
]

/**
 * The likes of every visitor, by session.
 * @type {Map<string, Set<string>>}
 */
const likesBySession = new Map()

const sessionCookie = 'library-session'

/**
 * Makes sure the request has a session, so that every visitor has their own likes.
 * The cookie is also added to the request, so that requests made by the router
 * while rendering the page see the same session.
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 */
export function ensureSession(request, response) {
	if (getSession(request)) return

	const session = randomUUID()
	request.headers.cookie = [request.headers.cookie, `${sessionCookie}=${session}`].filter(Boolean).join('; ')
	response.setHeader('set-cookie', `${sessionCookie}=${session}; Path=/; HttpOnly; SameSite=Lax`)
}

/** @param {IncomingMessage} request */
function getSession(request) {
	return request.headers.cookie?.match(new RegExp(`(?:^|; )${sessionCookie}=([^;]+)`))?.[1]
}

/** @param {IncomingMessage} request */
function likesFor(request) {
	const session = getSession(request) ?? ''
	let likes = likesBySession.get(session)
	if (!likes) {
		likes = new Set()
		likesBySession.set(session, likes)
	}
	return likes
}

/** @type {Record<string, (a: typeof books[number], b: typeof books[number]) => number>} */
const compare = {
	year: (a, b) => a.year - b.year,
	title: (a, b) => a.title.localeCompare(b.title)
}

const bookPattern = new URLPattern({ pathname: '/api/books/:id{/like}?' })

/**
 * @param {ServerResponse} response
 * @param {number} status
 * @param {unknown} body
 */
function json(response, status, body) {
	return response
		.writeHead(status, { 'content-type': 'application/json' })
		.end(JSON.stringify(body))
}

/**
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 */
export function handleApi(request, response) {
	const url = new URL(request.url ?? '/', 'http://localhost')
	const likes = likesFor(request)

	/** @param {Omit<typeof books[number], 'summary'>} book */
	const withLike = (book) => ({ ...book, liked: likes.has(book.id) })

	// GET /api/books?q=<search>&sort=<year|title>&liked=true
	if (url.pathname == '/api/books' && request.method == 'GET') {
		const query = url.searchParams.get('q')?.trim().toLowerCase()
		const sort = compare[url.searchParams.get('sort') ?? 'year'] ?? compare.year
		const result = books
			.filter(({ title, author }) => !query || `${title} ${author}`.toLowerCase().includes(query))
			.filter(({ id }) => url.searchParams.get('liked') != 'true' || likes.has(id))
			.toSorted(sort)
		return json(response, 200, result.map(({ summary, ...book }) => withLike(book)))
	}

	const bookMatch = bookPattern.exec(url)
	const book = books.find(book => book.id == bookMatch?.pathname.groups.id)

	if (!book) {
		return json(response, 404, { error: 'Not found' })
	}

	// GET /api/books/:id
	if (!url.pathname.endsWith('/like') && request.method == 'GET') {
		return json(response, 200, withLike(book))
	}

	// PUT /api/books/:id/like and DELETE /api/books/:id/like
	if (url.pathname.endsWith('/like') && (request.method == 'PUT' || request.method == 'DELETE')) {
		if (request.method == 'PUT') {
			likes.add(book.id)
		} else {
			likes.delete(book.id)
		}
		return json(response, 200, withLike(book))
	}

	return json(response, 405, { error: 'Method not allowed' })
}
