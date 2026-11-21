// On the server this resolves to the server router (via the "node" export condition),
// and in the browser to the browser router (via the import map in layout.html).
import { Router } from '@applicvision/frontend-friends/router'
import { store } from './store.js'
import { Book } from './book.js'

export const router = Router.create({
	layout: 'layout.html',
	view: 'home.html',
	children: {
		about: {
			view: 'about.html'
		},
		books: {
			layout: 'books/layout.html',
			view: 'books/list.html',
			store: store.books,
			load: (get, _params, query) =>
				get([Book], query.size > 0 ? `/api/books?${query}` : '/api/books'),
			children: {
				':id': {
					view: 'books/book.html',
					store: store.books,
					load: (get, { id }) => get(Book, `/api/books/${id}`)
				}
			}
		}
	}
})
