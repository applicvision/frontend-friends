import { html, island } from '@applicvision/frontend-friends'
import { router } from '../router.js'
import { store, toggleLike } from '../store.js'

const sortOrders = [['year', 'Year'], ['title', 'Title']]

/**
 * A link to the book list with another sort order, keeping the search.
 * The sort order is part of the URL, so it is rendered on the server,
 * and works with the back button and without JavaScript.
 * @param {string} sort
 * @param {string} label
 */
function sortLink(sort, label) {
	const query = new URLSearchParams(router.query)
	query.set('sort', sort)
	const isCurrent = (router.query.get('sort') ?? 'year') == sort
	return html`<a href=${`${router.linkTo('books')}?${query}`} aria-current=${isCurrent ? 'true' : false}>${label}</a>`
}

export default island(() => {
	// Read through the store, so that likes are reflected directly
	const books = (router.dataFor('books') ?? []).map(({ id }) => store.books.get(id))

	if (books.length == 0) {
		return html`<p>No books found.</p>`
	}

	return html`
		<nav aria-label="Sort by">
			Sort by ${sortOrders.map(([sort, label]) => html`${sortLink(sort, label)} `)}
		</nav>
		<ul aria-label="Book list">${books.map(book => html.key(book.id)`
			<li>
				<a href=${router.linkTo('books/:id', { id: book.id })}>${book.title}</a>
				<span>by ${book.author}, ${book.year}</span>
				<button
					aria-label=${`Like ${book.title}`}
					aria-pressed=${book.liked ? 'true' : 'false'}
					onclick=${() => toggleLike(book)}
				>${book.liked ? '♥' : '♡'}</button>
			</li>`)}
		</ul>`
})
