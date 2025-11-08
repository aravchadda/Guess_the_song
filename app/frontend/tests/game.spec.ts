import { test, expect } from '@playwright/test';

test.describe('Guess The Song Game', () => {
  test('should load home page', async ({ page }) => {
    await page.goto('/');
    
    // Check title
    await expect(page.locator('h1')).toContainText('Guess The Song');
    
    // Check mode buttons exist
    await expect(page.locator('text=Random Song')).toBeVisible();
    await expect(page.locator('text=Pick a Decade')).toBeVisible();
    await expect(page.locator('text=View Statistics')).toBeVisible();
  });
  
  test('should navigate to random game', async ({ page }) => {
    await page.goto('/');
    
    // Click random mode
    await page.click('text=Random Song');
    
    // Should be on game page
    await expect(page).toHaveURL(/\/game\?mode=random/);
  });
  
  test('should show decade picker for decade mode', async ({ page }) => {
    await page.goto('/');
    
    // Click decade mode
    await page.click('text=Pick a Decade');
    
    // Should show decade picker
    await expect(page.locator('text=Choose a Decade')).toBeVisible();
    await expect(page.locator('text=1980s')).toBeVisible();
  });
  
  test('should navigate to stats page', async ({ page }) => {
    await page.goto('/');
    
    // Click stats
    await page.click('text=View Statistics');
    
    // Should be on stats page
    await expect(page).toHaveURL(/\/stats/);
    await expect(page.locator('text=Statistics')).toBeVisible();
  });
});

test.describe('Game Flow (Mock)', () => {
  test.beforeEach(async ({ page }) => {
    // Note: These tests would require a running backend with test data
    // For now, they test the UI structure
  });
  
  test('should show loading state', async ({ page }) => {
    await page.goto('/game?mode=random');
    
    // Should show loading or game UI
    const isLoading = await page.locator('text=Loading').isVisible().catch(() => false);
    const isGame = await page.locator('text=Level').isVisible().catch(() => false);
    
    expect(isLoading || isGame).toBeTruthy();
  });
});

