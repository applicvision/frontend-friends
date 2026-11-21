import { html, island } from '@applicvision/frontend-friends'
import { router } from '../router.js'
import { isLiked, toggleLike } from '../store.js'

/** @import {Book} from '../book.js' */

/** @type {Record<'year' | 'title', (a: Book, b: Book) => number>} */
const compare = {
	year: (a, b) => a.year - b.year,
	title: (a, b) => a.title.localeCompare(b.title)
}

// The sort order is state of the island, so it is kept when navigating within the app.
export default island({ sortBy: /** @type {'year' | 'title'} */ ('year') }, (state) => {
	const books = router.dataFor('books') ?? []

	if (books.length == 0) {
		return html`<p>No books found.</p>`
	}

	return html`
		<p>
			Sort by
			<button aria-pressed=${state.sortBy == 'year' ? 'true' : 'false'} onclick=${() => state.sortBy = 'year'}>Year</button>
			<button aria-pressed=${state.sortBy == 'title' ? 'true' : 'false'} onclick=${() => state.sortBy = 'title'}>Title</button>
		</p>
		<ul aria-label="Book list">${books.toSorted(compare[state.sortBy]).map(book => html.key(book.id)`
			<li>
				<a href=${router.linkTo('books/:id', { id: book.id })}>${book.title}</a>
				<span>by ${book.author}, ${book.year}</span>
				<button
					aria-label=${`Like ${book.title}`}
					aria-pressed=${isLiked(book.id) ? 'true' : 'false'}
					onclick=${() => toggleLike(book.id)}
				>${isLiked(book.id) ? '♥' : '♡'}</button>
			</li>`)}
		</ul>`
})
