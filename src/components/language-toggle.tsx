"use client";

import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui";

// Uses the shared Button so it looks identical to the other header buttons in
// both languages (same size, border, and font). Shows the language you can
// switch TO (中文 when in English, English when in 中文).
export function LanguageToggle({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const { lang, toggle } = useI18n();
  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      className={className}
      onClick={toggle}
      aria-label="Switch language"
    >
      {lang === "en" ? "中文" : "English"}
    </Button>
  );
}
