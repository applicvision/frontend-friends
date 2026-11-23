import { html, island } from '@applicvision/frontend-friends'
import { router } from '../router.js'
import { store, toggleLike } from '../store.js'

export default island(() => {
	// Read through the store, so that the like button reflects changes
	const book = store.books.get(router.dataFor('books/:id').id)

	return html`
		<article>
			<h3>${book.title}</h3>
			<p>by ${book.author}, ${book.year}</p>
			<p>${book.summary}</p>
			<button
				aria-pressed=${book.liked ? 'true' : 'false'}
				onclick=${() => toggleLike(book)}
			>${book.liked ? 'Liked ♥' : 'Like'}</button>
			<a href=${router.linkTo('books')}>All books</a>
		</article>`
})
