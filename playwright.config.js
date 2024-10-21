import { defineConfig } from '@playwright/test'

export default defineConfig({
	testDir: 'ci',
	webServer: {
		command: 'npx test-browser',
		url: 'http://localhost:3000',
		reuseExistingServer: !process.env.CI
	}
})
