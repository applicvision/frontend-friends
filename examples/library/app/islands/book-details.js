import { html, island } from '@applicvision/frontend-friends'
import { router } from '../router.js'
import { isLiked, toggleLike } from '../store.js'

export default island(() => {
	const book = router.dataFor('books/:id')

	return html`
		<article>
			<h3>${book.title}</h3>
			<p>by ${book.author}, ${book.year}</p>
			<p>${book.summary}</p>
			<button
				aria-pressed=${isLiked(book.id) ? 'true' : 'false'}
				onclick=${() => toggleLike(book.id)}
			>${isLiked(book.id) ? 'Liked ♥' : 'Like'}</button>
			<a href=${router.linkTo('books')}>All books</a>
		</article>`
})
