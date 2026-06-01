// tests/e2e/specs/happy-path.spec.ts
import { test, expect } from '@playwright/test';
import { MOCK_JD } from '../fixtures/mock-jd';

test.describe('Resume CI — Complete User Journey', () => {

  test('1. JD input → parse → keyword cloud visible', async ({ page }) => {
    await page.goto('/');
    const textarea = page.getByTestId('jd-textarea');
    await textarea.fill(MOCK_JD);
    await page.getByTestId('parse-btn').click();
    await expect(page.getByTestId('keyword-cloud')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('kw-tag').first()).toBeVisible();
  });

  test('2. Match radar renders after JD parse', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('jd-textarea').fill(MOCK_JD);
    await page.getByTestId('parse-btn').click();
    await expect(page.getByTestId('radar-chart')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('match-radar')).toContainText(/匹配度/);
  });

  test('3. Navigate to Blueprint → skeletons → cards appear', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('jd-textarea').fill(MOCK_JD);
    await page.getByTestId('parse-btn').click();
    await page.getByTestId('next-step').click();
    await expect(page.getByTestId('skeleton')).toHaveCount(3);
    await expect(page.getByTestId('card').first()).toBeVisible({ timeout: 30000 });
  });

  test('4. Select project → architecture diagram renders', async ({ page }) => {
    await page.goto('/?step=blueprint');
    await page.getByTestId('card').first().click({ timeout: 30000 });
    await expect(page.getByTestId('mermaid-container')).toBeVisible({ timeout: 15000 });
  });

  test('5. FlashCard flip interaction', async ({ page }) => {
    await page.goto('/?step=blueprint');
    await page.getByTestId('card').first().click({ timeout: 30000 });
    await page.getByTestId('flash-card').first().click();
    await expect(page.getByText(/点击翻回/)).toBeVisible();
  });

  test('6. Full alignment Q&A flow', async ({ page }) => {
    await page.goto('/?step=alignment');
    for (let i = 0; i < 5; i++) {
      await expect(page.getByTestId('question-flow')).toBeVisible({ timeout: 10000 });
      await page.locator('[data-testid="question-flow"] button').first().click();
      await page.getByTestId('submit-answer').click();
      await expect(page.getByTestId('star-bullet')).toHaveCount(i + 1, { timeout: 10000 });
    }
  });

  test('7. Resume edit: double-click → type → Enter → saved', async ({ page }) => {
    await page.goto('/?step=polish');
    const paragraph = page.locator('[data-section]').first();
    await paragraph.dblclick();
    await page.keyboard.type(' test edit');
    await page.keyboard.press('Enter');
    await expect(paragraph).toContainText('test edit');
  });

  test('8. Export pipeline → download button appears', async ({ page }) => {
    await page.goto('/?step=export');
    await expect(page.getByText('排版对齐')).toBeVisible();
    await expect(page.getByText('下载 PDF')).toBeVisible({ timeout: 60000 });
  });
});
