import { Page, Locator, expect } from '@playwright/test';

/**
 * Shared search helper for pages that use a text input to filter a data table.
 * Used by Clients, Leads, Equipamentos, and other list pages.
 */
export class SearchHelper {
  readonly page: Page;
  readonly searchInput: Locator;

  constructor(page: Page, placeholder = 'Buscar') {
    this.page = page;
    this.searchInput = page.locator(`input[placeholder*="${placeholder}"]`);
  }

  async expectSearchInputVisible() {
    await expect(this.searchInput).toBeVisible();
  }

  /**
   * Fill the search input with a query and wait for debounce.
   */
  async typeQuery(query: string, debounceMs = 800) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(debounceMs);
  }

  /**
   * Clear the search input and wait for debounce.
   */
  async clearQuery(debounceMs = 800) {
    await this.searchInput.clear();
    await this.page.waitForTimeout(debounceMs);
  }

  /**
   * Returns the current value of the search input.
   */
  async getQuery(): Promise<string> {
    return this.searchInput.inputValue();
  }
}
