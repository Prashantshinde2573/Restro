import { redirect } from "next/navigation";

// Restaurants are added by the Rastropi team (super admin), not by self sign-up.
export default function Onboarding() {
  redirect("/login");
}
