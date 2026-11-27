import { getStore } from '@applicvision/frontend-friends/store'
import { parse } from '@applicvision/frontend-friends/parse-shape'
import { Book } from './book.js'

/**
 * The store is shared between the routes and the islands.
 * The books loaded by the routes are upserted into it,
 * so a change made in one view is seen in the others.
 */
export const store = getStore({ books: Book })

/** @param {Book} book */
export async function toggleLike(book) {
	const response = await fetch(`/api/books/${book.id}/like`, { method: book.liked ? 'DELETE' : 'PUT' })
	if (!response.ok) {
		throw new Error(`Could not update like: ${response.status}`)
	}
	store.books.upsert(parse(Book, await response.json()))
}
