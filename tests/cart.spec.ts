import { test, expect, Page } from '@playwright/test';
import { registerUser } from './helpers';

// Known catalog prices (USD / month)
const PRICE = { LIVE: 39, AUTOMATE: 129, PERCY: 199 };

// Formats a number the way the app displays prices, e.g. 195 -> "$195.00"
const money = (value: number) => `$${value.toFixed(2)}`;

// Returns the product card for a given SKU on the catalog page
const card = (page: Page, sku: string) => page.getByTestId(`product-${sku}`);

// Sets the quantity inside a product card and clicks "Add to cart"
async function addToCart(page: Page, sku: string, qty: number) {
  await card(page, sku).getByTestId('product-qty').fill(String(qty));
  await card(page, sku).getByTestId('add-to-cart').click();
}

// Opens the cart page and waits for it to render
async function openCart(page: Page) {
  await page.getByTestId('nav-cart').click();
  await expect(page).toHaveURL(/#\/cart/);
}

// Every test starts with a brand-new user, so each one has its own empty cart
test.beforeEach(async ({ page }) => {
  await registerUser(page, 'Cart Tester');
});

test('new user has an empty cart', async ({ page }) => {
  // Open the cart of a freshly registered user
  await openCart(page);

  // The empty state is shown and the counter is zero
  await expect(page.getByTestId('cart-empty')).toBeVisible();
  await expect(page.getByTestId('cart-item')).toHaveCount(0);
  await expect(page.getByTestId('cart-count')).toHaveText('0');
});

test('add one product shows one line with correct subtotal and total', async ({ page }) => {
  // Add one Live plan from the catalog
  await addToCart(page, 'BS-LIVE', 1);
  await expect(page.getByTestId('cart-count')).toHaveText('1');

  // The cart has exactly one line with the right amounts
  await openCart(page);
  await expect(page.getByTestId('cart-item')).toHaveCount(1);
  await expect(page.getByTestId('cart-qty')).toHaveValue('1');
  await expect(page.getByTestId('cart-subtotal')).toHaveText(money(PRICE.LIVE));
  await expect(page.getByTestId('cart-total')).toContainText(money(PRICE.LIVE));
});

test('two different products: counter counts units and total sums the subtotals', async ({ page }) => {
  // Add Live x1 and Automate x2
  await addToCart(page, 'BS-LIVE', 1);
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await addToCart(page, 'BS-AUTOMATE', 2);

  // The counter shows units (1 + 2), not lines
  await expect(page.getByTestId('cart-count')).toHaveText('3');

  // Two lines, each with its own subtotal, and the total is their sum
  await openCart(page);
  await expect(page.getByTestId('cart-item')).toHaveCount(2);
  await expect(page.getByTestId('cart-subtotal')).toHaveText([
    money(PRICE.LIVE),
    money(PRICE.AUTOMATE * 2),
  ]);
  await expect(page.getByTestId('cart-total')).toContainText(money(PRICE.LIVE + PRICE.AUTOMATE * 2));
});

test('adding the same product twice merges into one line', async ({ page }) => {
  // Add Live x1, then Live x2
  await addToCart(page, 'BS-LIVE', 1);
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await addToCart(page, 'BS-LIVE', 2);
  await expect(page.getByTestId('cart-count')).toHaveText('3');

  // There is a single line with the summed quantity
  await openCart(page);
  await expect(page.getByTestId('cart-item')).toHaveCount(1);
  await expect(page.getByTestId('cart-qty')).toHaveValue('3');
  await expect(page.getByTestId('cart-subtotal')).toHaveText(money(PRICE.LIVE * 3));
  await expect(page.getByTestId('cart-total')).toContainText(money(PRICE.LIVE * 3));
});

test('changing the quantity in the cart updates the amounts and persists after reload', async ({ page }) => {
  // Start with Live x1 and Automate x2
  await addToCart(page, 'BS-LIVE', 1);
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await addToCart(page, 'BS-AUTOMATE', 2);
  await expect(page.getByTestId('cart-count')).toHaveText('3');
  await openCart(page);

  // Change the Live quantity to 5 (applied on blur, so press Tab)
  const liveLine = page.getByTestId('cart-item').first();
  await liveLine.getByTestId('cart-qty').fill('5');
  await liveLine.getByTestId('cart-qty').press('Tab');

  // Subtotal, total and counter are recalculated (5 + 2 = 7 units)
  const expectedTotal = PRICE.LIVE * 5 + PRICE.AUTOMATE * 2;
  await expect(liveLine.getByTestId('cart-subtotal')).toHaveText(money(PRICE.LIVE * 5));
  await expect(page.getByTestId('cart-total')).toContainText(money(expectedTotal));
  await expect(page.getByTestId('cart-count')).toHaveText('7');

  // After a reload the server-side cart still has the new values
  await page.reload();
  await expect(page.getByTestId('cart-item')).toHaveCount(2);
  await expect(page.getByTestId('cart-item').first().getByTestId('cart-qty')).toHaveValue('5');
  await expect(page.getByTestId('cart-total')).toContainText(money(expectedTotal));
  await expect(page.getByTestId('cart-count')).toHaveText('7');
});

test('removing items recalculates the total and the last removal shows the empty cart', async ({ page }) => {
  // Start with Live x5 and Automate x2
  await addToCart(page, 'BS-LIVE', 5);
  await expect(page.getByTestId('cart-count')).toHaveText('5');
  await addToCart(page, 'BS-AUTOMATE', 2);
  await expect(page.getByTestId('cart-count')).toHaveText('7');
  await openCart(page);
  await expect(page.getByTestId('cart-total')).toContainText(money(PRICE.LIVE * 5 + PRICE.AUTOMATE * 2));

  // Remove the first line (Live): only Automate remains
  await page.getByTestId('cart-item').first().getByTestId('cart-remove').click();
  await expect(page.getByTestId('cart-item')).toHaveCount(1);
  await expect(page.getByTestId('cart-total')).toContainText(money(PRICE.AUTOMATE * 2));
  await expect(page.getByTestId('cart-count')).toHaveText('2');

  // Remove the last line: the empty state appears and the counter is zero
  await page.getByTestId('cart-item').first().getByTestId('cart-remove').click();
  await expect(page.getByTestId('cart-empty')).toBeVisible();
  await expect(page.getByTestId('cart-item')).toHaveCount(0);
  await expect(page.getByTestId('cart-count')).toHaveText('0');
});

// Quantities outside 1-99 are rejected by the API
for (const invalidQty of [0, 100]) {
  test(`invalid quantity ${invalidQty} in the catalog shows an error and keeps the cart unchanged`, async ({ page }) => {
    // Try to add Live with an invalid quantity
    await addToCart(page, 'BS-LIVE', invalidQty);

    // The error toast is shown and the counter does not change
    await expect(page.getByTestId('toast')).toHaveText('Quantity must be between 1 and 99');
    await expect(page.getByTestId('cart-count')).toHaveText('0');

    // The cart is still empty (state check, not only the toast)
    await openCart(page);
    await expect(page.getByTestId('cart-empty')).toBeVisible();
  });
}

// KNOWN BUG: when the cart already holds 99 units of a product, adding more is
// silently capped at 99. The API answers 201 and the UI shows "Added to cart",
// but nothing tells the user the limit was reached. Expected: an error message.
test.fixme('adding beyond 99 units is rejected with a message instead of being silently capped', async ({ page }) => {
  // Add the maximum allowed quantity (99) of Live
  await addToCart(page, 'BS-LIVE', 99);
  await expect(page.getByTestId('cart-count')).toHaveText('99');

  // Add 99 more: the user should be told the limit was exceeded
  await addToCart(page, 'BS-LIVE', 99);
  await expect(page.getByTestId('toast')).toHaveText(/between 1 and 99|limit|maximum/i);
  await expect(page.getByTestId('cart-count')).toHaveText('99');
});
