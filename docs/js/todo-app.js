import { html, island, ref, twoway } from '@applicvision/frontend-friends'
import { effect } from '@applicvision/frontend-friends/deep-watch'
import './todo-box.js'
import { shape } from '@applicvision/frontend-friends/parse-shape'
import { tokens } from '@applicvision/frontend-friends/attribute-helpers'


let todoId = -1

class Todo {
	/** @param {string} title */
	constructor(title) {
		this.title = title
		this.done = false
		this.id = ++todoId
	}

	/** @param {Todo[]} todos */
	static saveToStorage(todos) {
		localStorage.setItem('todos', JSON.stringify(todos))
	}

	static parseFromStorage() {
		const stored = shape([
			{ title: String, id: Number, done: Boolean }
		]).parse(JSON.parse(localStorage.getItem('todos') ?? '[]'))
		return stored.map(({ title, done, id }) => {
			const todo = new Todo(title)
			todo.done = done
			todo.id = id
			todoId = id
			return todo
		})
	}
}


const app = island({
	refs: {
		input: ref(HTMLInputElement)
	},
	state: {
		/** @type {''|'done'|'todo'} */
		currentFilter: '',
		currentInput: '',
		/** @type {Todo[]} */
		todos: effect(Todo.parseFromStorage(), Todo.saveToStorage),
		/** @type {Todo|null} */
		editingTodo: null
	}
}, ({ refs, state }) => {
	const filteredTodos = state.currentFilter ?
		state.todos.filter(todo => state.currentFilter == 'done' ? todo.done : !todo.done) :
		state.todos

	return html`
		<form onsubmit=${addNewTodo}>
			<input autofocus ff-ref=${refs.input} required name=title placeholder="Enter new todo" ff-share=${twoway(state, 'currentInput')}>
			${state.editingTodo ?
			html`
				<button type="button" onclick=${stopEditing}>Cancel</button>
				<button>Update</button>
			`
			: html`<button>Add</button>`
		}
		</form>
		<ul class=todo-list>
			${filteredTodos.map(todo => {
			const isEditing = state.editingTodo?.id == todo.id
			return html.key(todo.id)`
					<li class=${tokens('todo-item', { isEditing })}>
						<todo-box ff-share=${twoway(todo, 'done')}></todo-box>
						<div class=title>${todo.title}</div>
						<section class="actions">
							<button type="button" class="edit" onclick=${() => editTodo(todo)}>✎</button>
							<button type="button" class="destructive" onclick=${() => removeTodo(todo)}>✕</button>
						</section>
					</li>`
		})}
		</ul>
		<fieldset id="filter">
			<legend>Filter</legend>
			<section>
				<label><input type="radio" name="radio" value="" ff-share=${twoway(state, 'currentFilter')}>Show all</label>
				<label><input type="radio" name="radio" value="done" ff-share=${twoway(state, 'currentFilter')}>Only done</label>
				<label><input type="radio" name="radio" value="todo" ff-share=${twoway(state, 'currentFilter')}>Only todo</label>
			</section>
			<button class="destructive" onclick=${clearDone}>Clear done</button>
		</fieldset>
		`
})


/**
 * @param {SubmitEvent} event 
 **/
function addNewTodo(event) {
	event.preventDefault()
	const { state } = app
	if (state.editingTodo) {
		state.editingTodo.title = state.currentInput
		state.editingTodo = null
	} else {
		app.state.todos.push(new Todo(state.currentInput))
	}
	state.currentInput = ''
}

/** @param {Todo} todoItem */
function editTodo(todoItem) {
	if (app.state.editingTodo?.id == todoItem.id) {
		return stopEditing()
	}
	app.state.editingTodo = todoItem
	app.state.currentInput = todoItem.title
	app.refs.input.element?.focus()
}

function stopEditing() {
	app.state.currentInput = ''
	app.state.editingTodo = null
}

/** @param {Todo} todoItem */
function removeTodo(todoItem) {
	const index = app.state.todos.findIndex(({ id }) => id == todoItem.id)
	if (index != -1) {
		app.state.todos.splice(index, 1)
	}
}

function clearDone() {
	const { todos } = app.state
	// Since we have an effect associated with the todos array,
	// we mutate it instead of filtering and resetting
	for (let index = todos.length - 1; index >= 0; index--) {
		if (todos[index].done) {
			todos.splice(index, 1)
		}
	}
}


export default app
