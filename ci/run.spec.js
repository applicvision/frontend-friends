import { test, expect } from '@playwright/test'

test('Check the unit tests', async ({ page }) => {
	await page.goto('http://localhost:3000?expand');

	await expect(page).toHaveTitle('All tests passed');

})


test('Test the todo app', async ({ page }) => {

	await page.goto('http://localhost:3001/frontend-friends/examples/todo/');

	await expect(page).toHaveTitle('ApplicVision - Frontend Friends');

	await page.getByRole('textbox', { name: 'Enter new todo' }).fill('first todo')
	await page.keyboard.press('Enter')

	await expect(page.locator('#app').getByRole('listitem').locator('todo-box')).toBeEmpty()

	await page.getByRole('textbox', { name: 'Enter new todo' }).fill('Another one')

	await page.getByRole('button', { name: 'Add' }).click()

	await expect(page.locator('#app').getByRole('listitem')).toHaveCount(2)

	await expect(page.locator('#app')
		.getByRole('listitem'))
		.toContainText(['first todo', 'Another one'])

	page.once('dialog', async dialog => {
		await expect(dialog.defaultValue()).toBe('first todo')
		await dialog.accept('Updated todo')
	})

	await page.locator('#app').getByRole('listitem').getByRole('button', { name: '✎' }).first().click()

	await expect(page.locator('#app')
		.getByRole('listitem'))
		.toContainText(['Updated todo', 'Another one'])

	await page.getByRole('listitem').filter({ hasText: 'Another one' }).locator('todo-box').click()
	await expect(page.getByRole('listitem').filter({ hasText: 'Another one' }).locator('todo-box')).toHaveText('✓')

	await page.reload()

	await expect(page.locator('#app')
		.getByRole('listitem'))
		.toContainText(['Updated todo', 'Another one'])

	await expect(
		page.locator('#app').getByRole('listitem').filter({ hasText: 'Another one' }).locator('todo-box')
	).toHaveText('✓')

	await page.locator('#app').getByRole('radio', { name: 'Only done' }).check()

	await expect(page.locator('#app').getByRole('listitem')).toHaveCount(1)
	await expect(page.locator('#app').getByRole('listitem')).toContainText('Another one')

	await page.locator('#app').getByRole('radio', { name: 'Only todo' }).check()

	await expect(page.locator('#app').getByRole('listitem')).toHaveCount(1)
	await expect(page.locator('#app').getByRole('listitem')).toContainText('Updated todo')

	await page.locator('#app').getByRole('radio', { name: 'Show all' }).check()

	await expect(page.locator('#app').getByRole('listitem')).toHaveCount(2)

	await page.getByRole('button', { name: 'Clear done' }).click()

	await expect(page.locator('#app').getByRole('listitem')).toHaveCount(1)
	await expect(page.locator('#app').getByRole('listitem')).toContainText('Updated todo')

	await page.reload()

	await expect(page.locator('#app').getByRole('listitem')).toHaveCount(1)
	await expect(page.locator('#app').getByRole('listitem')).toContainText('Updated todo')

	await page.locator('#app').getByRole('listitem').getByRole('button', { name: '✕' }).click()

	await expect(page.locator('#app').getByRole('list')).toBeEmpty()

})
