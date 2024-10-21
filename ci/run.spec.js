import { test, expect } from '@playwright/test'

test('Run the tests', async ({ page }) => {
	await page.goto('http://localhost:3000?expand');

	await expect(page).toHaveTitle('All tests passed');

})
