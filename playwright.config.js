import { defineConfig } from '@playwright/test'

export default defineConfig({
	testDir: 'ci',
	webServer: [{
		command: 'npx test-browser',
		url: 'http://localhost:3000',
		reuseExistingServer: !process.env.CI
	},
	{
		command: 'npm run serve-docs -- --no-watch --port 3001',
		url: 'http://localhost:3001/frontend-friends/',
		reuseExistingServer: !process.env.CI
	}]
})
