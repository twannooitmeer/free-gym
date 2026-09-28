import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

const state = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '.state.json'), 'utf8')) as {
  tag: string
  password: string
  sessionId: number
  title: string
  teacherEmail: string
  memberName: string
  checkInCode: string
}

test('a new member signs up, books, sees the banner, shows the code and cancels', async ({ page }) => {
  await page.goto('/en/signup')
  await page.getByLabel('Name').fill('Robin E2E')
  await page.getByLabel('Email').fill(`robin-${state.tag}@example.test`)
  await page.getByLabel('Password').fill(state.password)
  await page.getByRole('button', { name: /create|sign up|account/i }).click()
  await page.waitForURL(/\/(verify|me)/)

  await page.goto(`/en/book/${state.sessionId}`)
  await page.getByRole('main').getByRole('button').last().click()
  await page.waitForURL(/\/en\/me\/bookings\/\d+$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(state.title, { ignoreCase: true })

  // The class starts in three hours, so the banner counts down to it.
  const banner = page.getByRole('status')
  await expect(banner).toContainText(state.title)
  await expect(banner).toContainText('starts in')
  await expect(page.getByRole('link', { name: 'Open registration' })).toBeVisible()

  await page.getByRole('button', { name: 'Show code at the counter' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('svg')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('Cancelled')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show code at the counter' })).toBeHidden()

  // Profile edits go through the site's action (the API refuses customers).
  await page.goto('/en/me')
  await page.getByLabel('Phone').fill('+31 20 000 0000')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Phone')).toHaveValue('+31 20 000 0000')
})

test('a scanned code shows nothing to strangers and lets the teacher check the member in', async ({
  page,
}) => {
  await page.goto(`/checkin/${state.checkInCode}`)
  await expect(page.getByText('This is a check-in code')).toBeVisible()
  await expect(page.getByText(state.memberName)).toBeHidden()

  await page.getByRole('link', { name: /Staff: sign in/ }).click()
  await page.getByLabel('Email').fill(state.teacherEmail)
  await page.getByLabel('Password').fill(state.password)
  await page.getByRole('button', { name: /log in/i }).click()
  await page.waitForURL(new RegExp(`/checkin/${state.checkInCode}$`))

  await expect(page.getByText(state.memberName)).toBeVisible()
  await page.getByRole('button', { name: 'Check in' }).click()
  await expect(page.getByText(/Checked in at/)).toBeVisible()
})
