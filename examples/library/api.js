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

const bookPattern = new URLPattern({ pathname: '/api/books/:id' })

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

	if (request.method != 'GET') {
		return json(response, 405, { error: 'Method not allowed' })
	}

	if (url.pathname == '/api/books') {
		const query = url.searchParams.get('q')?.trim().toLowerCase()
		const result = query ?
			books.filter(({ title, author }) => `${title} ${author}`.toLowerCase().includes(query)) :
			books
		return json(response, 200, result.map(({ summary, ...book }) => book))
	}

	const bookMatch = bookPattern.exec(url)
	if (bookMatch) {
		const book = books.find(book => book.id == bookMatch.pathname.groups.id)
		if (!book) {
			return json(response, 404, { error: 'Book not found' })
		}
		return json(response, 200, book)
	}

	return json(response, 404, { error: 'Not found' })
}
