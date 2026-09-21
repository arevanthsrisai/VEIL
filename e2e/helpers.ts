import { Page, expect } from "@playwright/test";

export type TestUser = {
  username: string;
  password: string;
  nickname: string;
};

export function uniqueUser(prefix = "user"): TestUser {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `${prefix}_${suffix}`,
    password: "Password123!",
    nickname: `Testy ${suffix.slice(-4)}`,
  };
}

export async function registerViaUi(page: Page, user: TestUser) {
  await page.goto("/register");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password").fill(user.password);
  await page.getByLabel("Nickname (public)").fill(user.nickname);
  await page.getByRole("group", { name: "Choose an avatar emoji" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible({ timeout: 10_000 });
}

export async function loginViaUi(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible({ timeout: 10_000 });
}

export async function registerViaApi(page: Page, user: TestUser) {
  const res = await page.request.post("/api/auth/register", {
    data: { username: user.username, password: user.password, nickname: user.nickname },
  });
  if (res.status() !== 201) throw new Error(`register failed: ${res.status()}`);
}
