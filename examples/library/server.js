import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

import { router } from './app/router.js'
import { ensureSession, handleApi } from './api.js'

const port = Number(process.env.PORT ?? 3002)

// In a real project the library would be loaded from node_modules or a CDN.
// Here the repository itself is served, so the example always uses the current code.
// The import map in app/layout.html maps '@applicvision/frontend-friends' to /lib,
// and the module specifiers are resolved here using the exports of package.json.
const packageDirectory = path.resolve(import.meta.dirname, '../..')
const { exports: packageExports } = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8'))
const browserConditions = ['browser', 'import', 'default']

const handleRoute = router.mount({ directory: path.join(import.meta.dirname, 'app') })

const server = createServer(async (request, response) => {
	const { pathname } = new URL(request.url ?? '/', 'http://localhost')

	if (pathname.startsWith('/api/')) {
		ensureSession(request, response)
		return handleApi(request, response)
	}

	if (pathname == '/lib' || pathname.startsWith('/lib/')) {
		return serveModuleSpecifier(pathname.slice('/lib'.length), response)
	}

	if (pathname.startsWith('/lib-files/')) {
		return serveLibraryFile(pathname.slice('/lib-files/'.length), response)
	}

	// The router handles all other requests, and responds with 404 for unknown routes.
	// The likes are per visitor, so make sure there is a session before the router loads any data.
	ensureSession(request, response)
	return handleRoute(request, response, server)
})

/**
 * Picks the browser version of an export, for instance of
 * { node: './src/router/server-router.js', default: './src/router/browser-router.js' }
 * @param {unknown} target
 * @returns {string | undefined}
 */
function resolveExport(target) {
	if (typeof target == 'string') return target
	if (typeof target != 'object' || target == null) return
	for (const condition of browserConditions) {
		const resolved = resolveExport(/** @type {Record<string, unknown>} */ (target)[condition])
		if (resolved) return resolved
	}
}

/**
 * Responds to a module specifier, such as '/island' for '@applicvision/frontend-friends/island',
 * with a module re-exporting the file it resolves to.
 * Browsers identify modules by the requested URL, so a redirect would load a file twice
 * if it is imported both with a specifier and with a relative path.
 * @param {string} subpath
 * @param {import('node:http').ServerResponse} response
 */
function serveModuleSpecifier(subpath, response) {
	const file = resolveExport(packageExports['.' + subpath])
	if (!file) {
		return response.writeHead(404).end()
	}
	return response
		.writeHead(200, { 'content-type': 'application/javascript' })
		// The library has no default exports, so export * is enough
		.end(`export * from '${path.posix.join('/lib-files', file)}'`)
}

/**
 * @param {string} file
 * @param {import('node:http').ServerResponse} response
 */
async function serveLibraryFile(file, response) {
	const sourceDirectory = path.join(packageDirectory, 'src')
	const filePath = path.join(packageDirectory, file)
	if (!filePath.startsWith(sourceDirectory + path.sep) || path.extname(filePath) != '.js') {
		return response.writeHead(404).end()
	}
	try {
		const { size } = await stat(filePath)
		response.writeHead(200, { 'content-type': 'application/javascript', 'content-length': size })
		await pipeline(createReadStream(filePath), response)
	} catch {
		response.writeHead(404).end()
	}
}

server.listen(port, () => {
	console.log(`Library example running at http://localhost:${port}`)
})
