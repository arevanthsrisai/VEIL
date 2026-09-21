import { test, expect } from "@playwright/test";
import { registerViaUi, loginViaUi, uniqueUser, type TestUser } from "./helpers";

test.describe("auth", () => {
  test("register creates an account and lands on the feed", async ({ page }) => {
    const user = uniqueUser();
    await registerViaUi(page, user);
    await expect(page).toHaveURL("/");
    await expect(page.getByText(user.nickname).first()).toBeAttached();
  });

  test("logout returns to the logged-out navbar", async ({ page }) => {
    const user = uniqueUser();
    await registerViaUi(page, user);
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
  });

  test("login with the same credentials works", async ({ page }) => {
    const user: TestUser = uniqueUser();
    await registerViaUi(page, user);
    await page.getByRole("button", { name: "Log out" }).click();
    await loginViaUi(page, user);
    await expect(page.getByText(user.nickname).first()).toBeAttached();
  });

  test("wrong password shows an error", async ({ page }) => {
    const user = uniqueUser();
    await registerViaUi(page, user);
    await page.getByRole("button", { name: "Log out" }).click();
    await page.goto("/login");
    await page.getByLabel("Username").fill(user.username);
    await page.getByLabel("Password").fill("WrongPassword!");
    await page.getByRole("main").getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByText("Invalid username or password.")).toBeVisible();
  });

  test("duplicate username registration is rejected", async ({ page }) => {
    const user = uniqueUser();
    await registerViaUi(page, user);
    await page.getByRole("button", { name: "Log out" }).click();
    await page.goto("/register");
    await page.getByLabel("Username").fill(user.username);
    await page.getByLabel("Password").fill(user.password);
    await page.getByLabel("Nickname (public)").fill(user.nickname);
    await page.getByRole("main").getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByText("Username is already taken.")).toBeVisible();
  });
});
