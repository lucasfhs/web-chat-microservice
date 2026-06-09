export type Theme = "light" | "dark";

export interface ThemeContextData {
  theme: Theme;
  toggleTheme: () => void;
}