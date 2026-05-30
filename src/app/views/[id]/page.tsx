import { redirect } from "next/navigation";

export default async function ViewRedirectPage() {
  redirect("/dashboard");
}
