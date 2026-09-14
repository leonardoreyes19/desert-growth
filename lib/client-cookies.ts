"use client";

export function setClientCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

export function setHtmlThemeAttribute(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
}
