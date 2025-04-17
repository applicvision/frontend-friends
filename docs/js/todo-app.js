import { html, island } from '@applicvision/frontend-friends'
import { twoway } from '@applicvision/frontend-friends'
import { effect } from '@applicvision/frontend-friends/deep-watch'
import './todo-box.js'
import { shape } from '@applicvision/frontend-friends/parse-shape'


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


const app = island(() => {
	return {
		state: {
			newTodoFieldValue: '',
			/** @type {''|'done'|'todo'} */
			currentFilter: '',
			/** @type {Todo[]} */
			todos: effect(Todo.parseFromStorage(), Todo.saveToStorage)
		}
	}
}, ({ state }) => {
	const filteredTodos = state.currentFilter ?
		state.todos.filter(todo => state.currentFilter == 'done' ? todo.done : !todo.done) :
		state.todos
	return html`
		<form onsubmit=${addNewTodo}>
			<input autofocus required name=title placeholder="Enter new todo">
			<button>Add</button>
		</form>
		<ul class=todo-list>
			${filteredTodos.map(todo => html`<li class="todo-item">
				<todo-box ff-share=${twoway(todo, 'done')}></todo-box>
				<div class=title>${todo.title}</div>
				<section class="actions">
					<button type="button" class="edit" onclick=${() => editTodo(todo)}>✎</button>
					<button type="button" class="destructive" onclick=${() => removeTodo(todo)}>✕</button>
				</section>
			</li>`.key(todo.id))}
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
 * @this {HTMLFormElement & {title: HTMLInputElement}}
 * @param {SubmitEvent} event 
 **/
function addNewTodo(event) {
	event.preventDefault()
	const titleField = this.title
	app.state.todos.push(new Todo(titleField.value))
	this.reset()
}

/** @param {Todo} todoItem */
function editTodo(todoItem) {
	const newValue = prompt('New title', todoItem.title)
	if (newValue) {
		todoItem.title = newValue
	}
}

/** @param {Todo} todoItem */
function removeTodo(todoItem) {
	const index = app.state.todos.findIndex(({ id }) => id == todoItem.id)
	if (index != -1) {
		app.state.todos.splice(index, 1)
	}
}

function clearDone() {
	app.state.todos = app.state.todos.filter(({ done }) => !done)
}


export default app
