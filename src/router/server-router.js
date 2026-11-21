import { Server, IncomingMessage, ServerResponse, OutgoingMessage } from 'node:http'
import path from 'node:path'
import { readFile, stat } from 'node:fs/promises'

import { BaseRouter, Route } from './base-router.js'
import { DynamicIsland } from '../dynamic-island.js'
import { parse } from '@applicvision/frontend-friends/parse-shape'
import { html } from '../dynamic-fragment.js'
import { pipeline } from 'node:stream/promises'
import { createReadStream } from 'node:fs'

class FakeResponse extends ServerResponse {
	#text = ''

	/** @type {Function?} */
	#resolveCompleted = null
	completed = new Promise((resolve) => {
		this.#resolveCompleted = resolve
	})

	/**
	* @param {any} chunk
	* @param {BufferEncoding | ((error?: Error | null) => void)} [encoding]
	* @param {(error?: Error | null) => void} [callback]
	* @returns {boolean}
	*/
	write(chunk, encoding, callback) {

		this.#text += chunk.toString()
		if (typeof callback == 'function') callback()
		else if (typeof encoding == 'function') encoding()

		return true
	}

	/**
	* @param {any | (() => void)} [chunk]
	* @param {BufferEncoding | (() => void)} [encoding]
	* @param {() => void} [callback]
	* @returns {this}
	*/
	end(chunk, encoding, callback) {
		if (chunk && (typeof chunk === 'string' || Buffer.isBuffer(chunk))) {
			this.#text += chunk.toString()
		}

		if (typeof callback === 'function') callback()
		else if (typeof encoding === 'function') encoding()

		this.#resolveCompleted?.()

		return this
	}

	get ok() {
		return this.statusCode >= 200 && this.statusCode < 300
	}

	get text() {
		return this.#text
	}

	get json() {
		return JSON.parse(this.#text)
	}
}

/** @type {Record<string, string>} */
const contentTypes = {
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.json': 'application/json',
	'.css': 'text/css',
	'.svg': 'image/svg+xml',
	'.html': 'text/html'
}

/** @param {string} file */
export function getContentType(file) {
	return contentTypes[path.extname(file)] ?? 'application/octet-stream'
}

/**
* @param {string} filePath 
* @return {Promise<import("node:http").OutgoingHttpHeaders>}
**/
async function contentHeaders(filePath) {
	const fileStats = await stat(filePath)
	if (fileStats.isDirectory()) {
		throw new Error('Unexpected directory')
	}
	return {
		'content-type': getContentType(filePath),
		'content-length': fileStats.size
	}
}



const islandContainerRegex = /(<ff-island src=")(?<islandSrc>[^"]+)(">.*?<\/ff-island>)/sdg

const routerScriptTagRegex = /(<ff-router src=")(?<src>[^"]+)("><\/ff-router>)/

export class Router extends BaseRouter {

	/**
	* @param {string} filePath
	*/
	async #loadViewFile(filePath) {
		const resolvedFilePath = path.join(this.#fileDirectory, filePath)

		const extension = path.extname(resolvedFilePath)

		if (extension == '.js' || extension == '.mjs') {
			throw new Error('JS files are not yet supported')
		}
		const fileContents = await readFile(resolvedFilePath)
		const view = fileContents.toString()

		// Normalize paths since we combine files

		const fileDirectory = path.dirname(resolvedFilePath)

		return view
			.replace(routerScriptTagRegex, (match, prefix, src, tail) => {
				if (src.startsWith('/')) {
					return match
				}
				const rewrittenSrc = path.join(fileDirectory, src)

				return prefix + rewrittenSrc + tail
			})
			.replaceAll(islandContainerRegex, (match, prefix, src, tail) => {
				if (src.startsWith('/')) {
					return match
				}

				const rewrittenSrc = path.join(fileDirectory, src)

				// const startIndex = '<ff-island src="'.length
				return prefix + rewrittenSrc + tail
			})
	}

	/**
	 * @param {Route} route
	 * @param {Route} [stopAtRoute]
	 */
	async loadView(route, stopAtRoute) {
		// if (!this.route) throw new Error('Can not load view because there is no current route')

		const routesToLoad = []
		if (route.view) {
			routesToLoad.push({ route, viewFile: route.view })
		}

		/** @type {Route|null} */
		let currentRoute = route

		while (currentRoute && currentRoute != stopAtRoute) {
			const { layout } = currentRoute
			if (layout) {
				routesToLoad.unshift({ route: currentRoute, viewFile: layout })
			}
			currentRoute = currentRoute.parent
		}

		try {
			const views = await Promise.all(routesToLoad
				.map(async ({ route, viewFile }) => {
					const fileContent = await this.#loadViewFile(viewFile)
					return fileContent
						.replace(/<ff-outlet>.*?<\/ff-outlet>/,
							html`
						<ff-outlet owner="${route.path}">
							<!-- ff-outlet-content -->
						</ff-outlet>`.staticHtmlString
						)
				}))

			return views.reduce((accumulatedView, view) => accumulatedView ? accumulatedView
				.replace("<!-- ff-outlet-content -->", view) : view
				, '')

		} catch (err) {
			console.log('Could not load view', err)
			throw err
		}
	}

	/**
	* @param {ServerResponse} response
	* @param {string} filePath
	*/
	async respondWithResource(response, filePath) {
		if (path.relative(this.#fileDirectory, filePath).startsWith('..')) {
			return response.writeHead(403).end('No access')
		}
		try {
			response.writeHead(200, await contentHeaders(filePath))
		} catch (error) {
			if (/** @type {NodeJS.ErrnoException} */(error).code == 'ENOENT') {
				return response.writeHead(404).end()
			}
			return response.writeHead(400).end()
		}
		return pipeline(createReadStream(filePath), response)
	}

	/**
	* @template T
	* @param {T} responseShape
	* @param {string} url
	* @param {IncomingMessage} request
	* @param {Record<string, string>} dataContainer
	*/
	async #injectRequest(responseShape, url, request, dataContainer) {

		const RequestClass = /** @type {typeof IncomingMessage} */(request.constructor)

		const localRequest = new RequestClass(request.socket)
		Object.assign(localRequest, request)
		localRequest.url = url

		const server = this.#server ??  /** @type {Server} */ (/** @type {any} */(request.socket).server)

		if (!server) throw new Error('Could not inject request. Missing server')

		const response = new FakeResponse(localRequest)
		server.emit('request', localRequest, response)
		await response.completed

		if (!response.ok) {
			throw new Error(`Inject request failed: ${response.statusCode} ${url}`)
		}

		dataContainer[url] = response.text

		return parse(responseShape, response.json)
	}

	/**
	* @param {{route: Route, params: Record<string, string>, query: URLSearchParams}} routeMatch
	* @param {IncomingMessage} request
	* @param {Record<string, string>} requestData
	*/
	loadRoute({ route, params, query }, request, requestData) {
		return route.load(
			(responseShape, input, init) =>
				typeof input == 'string' && !URL.canParse(input) ?
					this.#injectRequest(responseShape, input, request, requestData) :
					getJSON(responseShape, input, requestData, init)
			,
			params,
			query
		)
	}

	#fileDirectory = '.'


	/** @type {Server?} */
	#server = null
	/**
	* @param {{directory?: string, base?: string}} [options]
	* @return {(request: IncomingMessage, response: ServerResponse, server: Server) => Promise<unknown>}
	*/
	mount(options) {
		super.mount(options)

		const routerPattern = new URLPattern({ pathname: `${this.basePath}/_ff-router/:type(resource|view)/*` })

		this.#fileDirectory = options?.directory ?? '.'
		return async (request, response, server) => {
			this.#server ??= server

			if (request.url == this.basePath || request.url?.startsWith(`${this.basePath}/`)) {
				const internalApiMatch = routerPattern.exec(request.url)
				if (internalApiMatch) {
					const { type, [0]: resource } = internalApiMatch.pathname.groups

					if (resource == null) return response.writeHead(400).end()

					if (type == 'view') {
						try {
							const searchParams = new URLSearchParams(internalApiMatch.search.input)
							const parent = searchParams.get('parent')
							const query = new URLSearchParams(searchParams.get('query') || undefined)
							const params = JSON.parse(searchParams.get('params') ?? '')

							const route = this.routeMap[resource]

							if (!route) return response.writeHead(404).end('No route found')

							const stopAtRoute = parent != null ? this.routeMap[parent] : undefined

							/** @type {Record<string, string>} */
							const requestData = {}

							const [viewHtml, data] = await Promise.all([
								this.loadView(route, stopAtRoute),
								this.loadRoute({ route, params, query }, request, requestData)
							])

							const responseObject = {
								view: viewHtml,
								data
							}

							return response
								.writeHead(200, { 'content-type': 'application/json' })
								.end(JSON.stringify(responseObject))
						} catch (error) {
							console.error('Error rendering view', error)
							return response.writeHead(500)
								.end('Could not process request')
						}
					}

					return this.respondWithResource(response, resource)
				}

				const routeMatch = this.resolve(request.url)

				if (!routeMatch) {
					return response.writeHead(404).end('Route not found')
				}

				try {
					/** @type {Record<string, string>} */
					const requestData = {}
					const [pageHtml, routeData] = await Promise.all([this.loadView(routeMatch.route), this.loadRoute(routeMatch, request, requestData)])

					const responseHtml = await this.#injectDynamicContent(pageHtml, { data: routeData, requestData, ...routeMatch })

					response.writeHead(200, { 'content-type': 'text/html' }).end(responseHtml)
				} catch (err) {
					console.error('Error rendering route', err)
					response.writeHead(500).end('Could not render route')
				}
			}
		}
	}

	/**
	 * @param {string} htmlContent
	 * @param {{route: Route, url: string, data: unknown, requestData: Record<string, string>, params: Record<string, string>, query: URLSearchParams}} state
	 */
	async #injectDynamicContent(htmlContent, { route, url, data, requestData, params, query }) {
		const islands = await this.#dynamicIslandsIn(htmlContent)
		if (islands.length > 0) {
			this.setDataForRendering(route, data, url, params, query, () => {

				htmlContent = islands.reduceRight((view, { island, src, start, end }) => {
					return view.slice(0, start) +
						html`<ff-island src="${src}" hydratable>${island.hydratable}</ff-island>`.staticHtmlString +
						view.slice(end)
				}, htmlContent)
				htmlContent = htmlContent.replace(routerScriptTagRegex,
					(_, __, routerSrc) => this.#clientRouterScriptWithData(routerSrc, requestData)
				)
			})
			return htmlContent
		}

		return htmlContent.replace(routerScriptTagRegex,
			(_, __, routerSrc) => clientRouterScript(this.basePath, routerSrc)
		)
	}

	/** 
	* @param {string} htmlString
	*/
	async #dynamicIslandsIn(htmlString) {
		const foundIslands = htmlString.matchAll(islandContainerRegex)

		/** @type {{src: string, start: number, end: number}[]} */
		const islandsToLoad = []
		for (const foundIsland of foundIslands) {
			const { islandSrc } = foundIsland.groups ?? {}
			const [start, end] = foundIsland.indices?.[0] ?? []

			start != null && end != null && islandsToLoad.push({
				src: islandSrc,
				start,
				end
			})
		}

		return Promise.all(islandsToLoad.map(async ({ src, start, end }) => {
			const [filePath, exportName = 'default'] = src.split('?')

			const module = await import(path.resolve(filePath))

			/** @type {DynamicIsland} */
			const island = module[exportName]

			return {
				src,
				island,
				start,
				end
			}
		}))
	}

	/** 
	 * @param {string} routerSrc 
	 * @param {Record<string, string>} loadData
	*/
	#clientRouterScriptWithData(routerSrc, loadData) {
		if (Object.keys(loadData).length == 0) {
			return clientRouterScript(this.basePath, routerSrc)
		}

		const routeData = JSON.stringify(loadData, null, 2)
			.replace(/</g, '\\u003c')

		return `
			<script id="ff-router-data" type="application/json">
			${routeData}
			</script>
			${clientRouterScript(this.basePath, routerSrc)}
		`.trim()

	}
}

/**
 * @template T
 * @param {T} responseShape
 * @param {string | URL | Request} input
 * @param {Record<string, string>} dataContainer
 * @param {RequestInit=} init
 */
async function getJSON(responseShape, input, dataContainer, init) {
	const response = await fetch(input, init)
	if (!response.ok) {
		throw new Error('Unexpected response: ' + response.status)
	}
	const rawResponse = await response.json()
	dataContainer[input.toString()] = JSON.stringify(rawResponse)
	return parse(responseShape, rawResponse)
}


/** 
* @param {string} base 
* @param {string} routerSrc
*/
function clientRouterScript(base, routerSrc) {
	const routerPath = path.join('/', base, '_ff-router/resource', routerSrc)
	return `
	<script type="module">
		import {router} from '${routerPath}'
		router.mount({base: '${base}'})
	</script>`.trim()
}

