import { getStore } from '@applicvision/frontend-friends/store'
import { Book, Like } from './book.js'

/**
 * The store is shared between the routes and the islands.
 * The books loaded by the routes are upserted into `books`,
 * and the likes made by the user are kept in `likes`.
 */
export const store = getStore({ books: Book, likes: Like })

/** @param {string} bookId */
export function isLiked(bookId) {
	return Boolean(store.likes.get(bookId))
}

/** @param {string} bookId */
export function toggleLike(bookId) {
	if (isLiked(bookId)) {
		store.likes.delete(bookId)
	} else {
		store.likes.insert(new Like(bookId))
	}
}
