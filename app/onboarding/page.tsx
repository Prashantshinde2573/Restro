import { redirect } from "next/navigation";

// Restaurants are added by the Restro team (super admin), not by self sign-up.
export default function Onboarding() {
  redirect("/login");
}
