import { expect, Page } from '@playwright/test';

export const PASSWORD = 'secret123';

// Builds an email that is unique per call (timestamp + random suffix).
export function uniqueEmail() {
  return `user${Date.now()}${Math.floor(Math.random() * 10000)}@example.com`;
}

// Registers a new user through the UI and returns the credentials,
// so every test creates its own data and stays independent.
export async function registerUser(page: Page, name = 'Test Auth') {
  const email = uniqueEmail();

  await page.goto('/#/register');
  await page.getByTestId('register-name').fill(name);
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill(PASSWORD);
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/#\/products/);

  // Wait for the product list to render. Leaving the page earlier triggers a
  // race in the app (it writes to a DOM element that no longer exists).
  await expect(page.getByTestId('product-name').first()).toBeVisible();

  return { name, email };
}
