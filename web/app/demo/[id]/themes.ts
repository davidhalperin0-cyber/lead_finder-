import { Assistant, Frank_Ruhl_Libre, Rubik } from "next/font/google";

export const serif = Frank_Ruhl_Libre({ subsets: ["hebrew", "latin"], weight: ["500", "700", "900"], variable: "--f-serif" });
export const rubik = Rubik({ subsets: ["hebrew", "latin"], weight: ["500", "700", "800"], variable: "--f-rubik" });
export const assistant = Assistant({ subsets: ["hebrew", "latin"], weight: ["400", "600", "700"], variable: "--f-text" });

export type Theme = {
  ground: string; // רקע הדף
  ink: string; // טקסט
  soft: string; // משטח שני, צעד טון אחד מהרקע
  accent: string; // כפתור ופס הביקורות
  onAccent: string;
  display: string; // גופן הכותרות
};

// צבע אחד, רקע אחד, הדגשה אחת לכל סוג עסק. בלי גרדיאנטים, בלי צללים.
export const THEMES: Record<string, Theme> = {
  beauty: { ground: "#F3ECE8", ink: "#1D1718", soft: "#E8DDD7", accent: "#6E2436", onAccent: "#FBF4F1", display: "var(--f-serif)" },
  food: { ground: "#F1EDE4", ink: "#18201B", soft: "#E3DDCF", accent: "#1F4D3A", onAccent: "#F1EDE4", display: "var(--f-rubik)" },
  health: { ground: "#EEF3F4", ink: "#0E242B", soft: "#DDE8EA", accent: "#0B6B74", onAccent: "#F4FAFB", display: "var(--f-rubik)" },
  auto: { ground: "#141618", ink: "#F1F0EC", soft: "#202326", accent: "#F2B705", onAccent: "#141618", display: "var(--f-rubik)" },
  pro: { ground: "#F2F1EC", ink: "#111821", soft: "#E3E2DA", accent: "#1C3553", onAccent: "#F2F1EC", display: "var(--f-serif)" },
  shop: { ground: "#FAFAF8", ink: "#121212", soft: "#ECEBE6", accent: "#B3122B", onAccent: "#FFFFFF", display: "var(--f-rubik)" },
};
