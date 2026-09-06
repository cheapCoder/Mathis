"use client";

import { useTranslations } from "next-intl";

// hover t("...") 里的字面量：会拼上命名空间，显示 greeting.xxx 的 zh/en 文案
export function Hello({ name }: { name: string }) {
  const t = useTranslations("greeting");
  const c = useTranslations("common");

  return (
    <section>
      <h1>{t("title", { name })}</h1>
      <p>{t("hint")}</p>
      <p>{t("nested.deep")}</p>
      <button type="button">{c("cancel")}</button>
      <button type="submit">{c("confirm")}</button>
    </section>
  );
}
