import { html, island } from '@applicvision/frontend-friends'
import { router } from '../router.js'

/** @type {['' | 'books' | 'about', string][]} */
const links = [
	['', 'Home'],
	['books', 'Books'],
	['about', 'About']
]

/** @param {'' | 'books' | 'about'} path */
function isActive(path) {
	const currentPath = (router.path ?? '').replace(/(.)\/$/, '$1')
	const linkPath = router.linkTo(path)
	// The home link is only active on the start page, the others for their whole section
	return currentPath == linkPath || (path != '' && currentPath.startsWith(linkPath + '/'))
}

export default island(() => html`
	<nav aria-label="Main">
		<ul>${links.map(([path, label]) => html`
			<li>
				<a href=${router.linkTo(path)} aria-current=${isActive(path) ? 'page' : false}>${label}</a>
			</li>`)}
		</ul>
	</nav>`
)
