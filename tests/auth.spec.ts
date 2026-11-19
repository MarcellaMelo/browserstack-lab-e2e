import { test, expect, Page } from '@playwright/test';

const PASSWORD = 'secret123';

// Builds an email that is unique per call (timestamp + random suffix).
function uniqueEmail() {
  return `user${Date.now()}${Math.floor(Math.random() * 10000)}@example.com`;
}

// Registers a new user through the UI and returns the credentials,
// so every test creates its own data and stays independent.
async function registerUser(page: Page, name = 'Test Auth') {
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

// Logs out and waits until the login page is shown.
async function logout(page: Page) {
  await page.getByTestId('logout-button').click();
  await expect(page).toHaveURL(/#\/login/);
  await expect(page.getByTestId('login-submit')).toBeVisible();
}

test('successful registration', async ({ page }) => {
  // Open the register page and fill the form with a unique email
  await page.goto('/#/register');
  await page.getByTestId('register-name').fill('Maria Test');
  await page.getByTestId('register-email').fill(uniqueEmail());
  await page.getByTestId('register-password').fill(PASSWORD);
  await page.getByTestId('register-submit').click();

  // The user lands on the products page and sees the greeting
  await expect(page).toHaveURL(/#\/products/);
  await expect(page.getByTestId('user-name')).toHaveText('Hi, Maria Test');
});

test('registration with an existing email shows an error', async ({ page }) => {
  // Create a user, then log out
  const { email } = await registerUser(page);
  await logout(page);

  // Try to register again with the same email
  await page.goto('/#/register');
  await page.getByTestId('register-name').fill('Another Name');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill(PASSWORD);
  await page.getByTestId('register-submit').click();

  // The error box is always in the DOM, so assert it has text
  await expect(page.getByTestId('register-error')).toHaveText(/.+/);
});

test('successful login', async ({ page }) => {
  // Create a user, then log out
  const { email } = await registerUser(page);
  await logout(page);

  // Log in with the valid credentials
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('login-submit').click();

  // The user is taken to the products page
  await expect(page).toHaveURL(/#\/products/);
});

test('login with a wrong password shows an error', async ({ page }) => {
  // Create a user, then log out
  const { email } = await registerUser(page);
  await logout(page);

  // Log in with a wrong password
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill('wrong-password');
  await page.getByTestId('login-submit').click();

  // The error box is always in the DOM, so assert it has text
  await expect(page.getByTestId('login-error')).toHaveText(/.+/);
});

test('logout returns to the login page', async ({ page }) => {
  // Create a user, which also logs them in
  await registerUser(page);

  // Log out and check we are back on the login page
  await page.getByTestId('logout-button').click();
  await expect(page).toHaveURL(/#\/login/);
});
