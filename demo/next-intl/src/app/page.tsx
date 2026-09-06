import { getTranslations } from "next-intl/server";
import { Hello } from "@/components/Hello";

// 服务端组件：await getTranslations("ns") 同样会被识别
export default async function Page() {
  const t = await getTranslations("greeting");

  return (
    <main>
      <title>{t("hint")}</title>
      <Hello name="Mathis" />
    </main>
  );
}
