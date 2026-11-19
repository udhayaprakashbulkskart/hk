import { redirect } from "next/navigation";

/** Legacy URL: gun skins now live under the weapon-skins category. */
export default function GunsPage() {
  redirect("/category/weapon-skins");
}
