import { DeclarativeElement } from '@applicvision/frontend-friends'
import { html } from '@applicvision/frontend-friends/dynamic-fragment'

/** @import {Router} from '@applicvision/frontend-friends/browser-router' */

/**
 * @attribute href - The destination of the link
 */
export class RouterLink extends DeclarativeElement {
	static observedAttributes = ['href']

	get href() {
		return this.getAttribute('href')
	}

	set href(newHref) {
		this.setAttribute('href', newHref ?? '')
	}

	/**
	 * @param {Event} event
	 */
	handleLinkClick(event) {
		event.preventDefault()
		this.href && appRouter?.transitionTo(this.href)
	}

	render() {
		return html`
		<a part="link" href=${this.href ?? ''} onclick=${this.handleLinkClick}>
			<slot></slot>
		</a>
		`
	}
}

/** @type {Router?} */
let appRouter = null

/**
 * @param {Router} router
 */
export function register(router) {
	appRouter = router
	customElements.define('router-link', RouterLink)
}
