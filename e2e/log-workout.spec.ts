import { test, expect, type Page } from '@playwright/test'

/** Each spec registers its own account so specs never share an active workout. */
async function registerFreshUser(page: Page, label: string) {
  const email = `e2e-${label}-${Date.now()}@example.com`
  await page.goto('/register')
  await page.getByLabel('Name').fill('E2E User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page).toHaveURL(/\/workout/)
  return email
}

async function addExercise(page: Page, title: string) {
  await page.getByRole('button', { name: '+ Add Exercise' }).click()
  await page.getByLabel('Search exercises').fill(title)
  await page.getByRole('checkbox', { name: title, exact: true }).click()
  await page.getByRole('button', { name: /add 1 exercise/i }).click()
}

test('register, log a workout, and see it in history', async ({ page }) => {
  await registerFreshUser(page, 'log')

  await page.getByRole('button', { name: /start empty workout/i }).click()
  await addExercise(page, 'Bench Press (Barbell)')

  await page.getByLabel('Weight (kg)').fill('60')
  await page.getByLabel('Reps').fill('10')
  await page.getByRole('checkbox', { name: 'Complete set 1' }).check()

  // Summary updates live from completed sets only.
  await expect(page.getByText('600 kg')).toBeVisible()

  await page.getByRole('button', { name: 'Finish' }).click()

  await expect(page).toHaveURL(/\/history/)
  await expect(page.getByText('600 kg')).toBeVisible()
})

test('a draft survives a page reload', async ({ page }) => {
  await registerFreshUser(page, 'reload')

  await page.getByRole('button', { name: /start empty workout/i }).click()
  await addExercise(page, 'Squat (Barbell)')
  await page.getByLabel('Weight (kg)').fill('100')

  await page.reload()

  await expect(page.getByText('Squat (Barbell)')).toBeVisible()
  await expect(page.getByLabel('Weight (kg)')).toHaveValue('100')
})

test('cardio exercises log distance and time, and show derived speed', async ({ page }) => {
  await registerFreshUser(page, 'cardio')

  await page.getByRole('button', { name: /start empty workout/i }).click()
  await addExercise(page, 'Treadmill')

  // A distance exercise must not offer weight or reps inputs.
  await expect(page.getByLabel('Distance (km)')).toBeVisible()
  await expect(page.getByLabel('Duration (seconds)')).toBeVisible()
  await expect(page.getByLabel('Reps')).toHaveCount(0)
  await expect(page.getByLabel('Weight (kg)')).toHaveCount(0)

  await page.getByLabel('Distance (km)').fill('5')
  await page.getByLabel('Duration (seconds)').fill('1695')

  await expect(page.getByText('10.6 km/h')).toBeVisible()
})

test('unticked sets are discarded on finish', async ({ page }) => {
  await registerFreshUser(page, 'discard')

  await page.getByRole('button', { name: /start empty workout/i }).click()
  await addExercise(page, 'Bench Press (Barbell)')

  await page.getByLabel('Weight (kg)').fill('50')
  await page.getByLabel('Reps').fill('10')
  await page.getByRole('checkbox', { name: 'Complete set 1' }).check()

  // A second set left unticked must not reach history.
  await page.getByRole('button', { name: '+ Add Set' }).click()
  await page.getByRole('button', { name: 'Finish' }).click()

  await expect(page).toHaveURL(/\/history/)
  await expect(page.getByText('1 set', { exact: true })).toBeVisible()
  await expect(page.getByText('500 kg')).toBeVisible()
})

test('logging out is enforced: protected pages redirect to login', async ({ page, context }) => {
  await registerFreshUser(page, 'auth')
  await context.clearCookies()

  await page.goto('/workout')
  await expect(page).toHaveURL(/\/login/)
})
