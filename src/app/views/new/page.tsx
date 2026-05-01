import { redirect } from "next/navigation";

export default function NewViewRedirectPage() {
  redirect("/dashboard");
}
