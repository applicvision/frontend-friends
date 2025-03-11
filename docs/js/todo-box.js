import { html } from '@applicvision/frontend-friends/dynamic-fragment'
import { css, DeclarativeElement } from '@applicvision/frontend-friends/declarative-element'


/** @extends {DeclarativeElement<boolean>} */
export default class TodoBox extends DeclarativeElement {
	static style = css`
		#trigger {
			width: 30px;
			height: 30px;
			padding: 3px;
			border-radius: 50%;
			background: inherit;
			transition: border 0.1s ease-out;
			border: 2px solid var(--accent-color);
			opacity: 0.7;
			&:hover, &:focus {
				opacity: 1;
			}
		}

		:host(:state(checked)) #indicator {
			scale: 1;
		}

		#indicator {
			background: var(--accent-color);
			width: 100%;
			height: 100%;
			border-radius: 50%;
			transition: scale 0.1s ease-out;
			display: flex;
			align-items: center;
			justify-content: center;
			scale: 0;
			color: var(--check-color);
		}
	`

	static sharedStateName = 'checked'

	toggle() {
		this.sharedState = !this.sharedState
	}

	render() {
		return html`<button 
				id=trigger
				part=wrapper
				onclick=${this.toggle}
			>
			<div id=indicator part=indicator>✓</div>
		</button>`
	}

	static {
		customElements.define('todo-box', this)
	}
}
