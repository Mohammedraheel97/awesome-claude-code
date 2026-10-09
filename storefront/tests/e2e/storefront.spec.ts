import { expect, test, type Page } from '@playwright/test';

/** Fails the test on any uncaught client-side error. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1);
}

test.describe('home', () => {
  test('renders Arabic RTL by default with brand, collections and footer', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'شوكولاتة' }).first()).toBeVisible();
    await expect(page.getByText('عرض كتالوج تجريبي')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('language switch goes to English and back, keeping the page', async ({ page }) => {
    await page.goto('/collections/chocolate');
    await page.getByRole('link', { name: 'English' }).first().click();
    await expect(page).toHaveURL(/\/collections\/chocolate$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1, name: 'Chocolate' })).toBeVisible();
    await page.getByRole('link', { name: 'العربية' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('skip link is the first focusable element', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'تخطي إلى المحتوى' })).toBeFocused();
  });
});

test.describe('collections and search', () => {
  test('collection sorting and availability filter update the URL and results', async ({ page }) => {
    await page.goto('/api/locale?lang=en&next=/collections/chocolate');
    await page.selectOption('#sort', 'price-desc');
    await page.getByLabel('In stock only').check();
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/sort=price-desc/);
    await expect(page).toHaveURL(/available=1/);
    const prices = await page.locator('.product-card .price').allTextContents();
    expect(prices.length).toBeGreaterThan(0);
    const nums = prices.map((p) => Number(p.replace(/[^\d.]/g, '')));
    const sorted = [...nums].sort((a, b) => b - a);
    expect(nums).toEqual(sorted);
  });

  test('empty search shows a prompt and unmatched search shows a clear empty state', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByText('اكتب اسم المنتج')).toBeVisible();
    await page.goto('/search?q=zzzz-no-match');
    await expect(page.getByText('لم نجد منتجات')).toBeVisible();
  });

  test('search returns matching products', async ({ page }) => {
    await page.goto('/search?q=chocolate');
    await expect(page.locator('.product-card').first()).toBeVisible();
    expect(await page.locator('.product-card').count()).toBeGreaterThan(1);
  });

  test('unknown collection returns 404 with a recovery link', async ({ page }) => {
    const response = await page.goto('/collections/does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('link', { name: 'العودة إلى الرئيسية' })).toBeVisible();
  });
});

test.describe('product and cart', () => {
  test('variant selection updates the URL and the selected option', async ({ page }) => {
    await page.goto('/api/locale?lang=en&next=/products/belgian-dark-chocolate-box');
    await page.getByRole('link', { name: '500 g' }).click();
    await expect(page).toHaveURL(/Size=500/);
    await expect(page.getByRole('link', { name: '500 g' })).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.product-info .price').first()).toContainText('6.000');
  });

  test('add to cart, update quantity, remove, and empty state', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/api/locale?lang=en&next=/products/milk-chocolate-bar-trio');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByText('Added to your cart.')).toBeVisible();
    await expect(page.getByLabel('2 items in cart').or(page.getByLabel('1 item in cart'))).toBeVisible();

    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Milk chocolate bar trio' })).toBeVisible();
    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(page.locator('.cart-line .quantity span').first()).toHaveText('2');
    await expect(page.getByRole('button', { name: 'Checkout' })).toBeDisabled();
    await expect(page.getByText('Checkout is not connected')).toBeVisible();

    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('sold-out product cannot be added', async ({ page }) => {
    await page.goto('/api/locale?lang=en&next=/products/rose-marzipan-box');
    await expect(page.getByRole('button', { name: 'Sold out' })).toBeDisabled();
    await expect(page.getByText('Currently unavailable')).toBeVisible();
  });

  test('product page exposes JSON-LD structured data', async ({ page }) => {
    await page.goto('/products/spiced-popcorn');
    const jsonld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const product = jsonld.map((t) => JSON.parse(t) as { '@type': string }).find((d) => d['@type'] === 'Product');
    expect(product).toBeTruthy();
  });
});

test.describe('layout and responsiveness', () => {
  for (const path of ['/', '/collections', '/collections/sweets', '/products/pistachio-baklava-tray', '/cart', '/search?q=sweet', '/about']) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('mobile menu opens and lists collections', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only check');
    await page.goto('/');
    await page.locator('.mobile-menu > summary').click();
    await expect(page.locator('.mobile-menu__panel').getByRole('link', { name: 'حلويات', exact: true })).toBeVisible();
  });

  test('footer navigation links resolve without errors', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page.locator('footer a[href^="/"]').evaluateAll((els) =>
      [...new Set(els.map((el) => el.getAttribute('href') as string))],
    );
    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), `footer link ${href}`).toBeLessThan(400);
    }
  });
});
