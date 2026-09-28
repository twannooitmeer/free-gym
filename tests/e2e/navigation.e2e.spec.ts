import { expect, test } from '@playwright/test'

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

  test('the menu button opens the navigation and takes you to the schedule', async ({ page }) => {
    await page.goto('/en')
    const menuButton = page.getByRole('button', { name: 'Open menu' })
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    await menuButton.click()
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Schedule' }).click()
    await page.waitForURL(/\/en\/schedule/)
    await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false')
  })
})

test('an unknown page shows the site-styled 404 with a way back', async ({ page }) => {
  const res = await page.goto('/nl/bestaat-niet')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pagina niet gevonden', { ignoreCase: true })
  await expect(page.getByRole('link', { name: 'Naar het rooster' })).toBeVisible()
})
