// Is online plan payment on? (No secrets: only whether keys are set, and test mode.)
import { json } from "@/lib/server/http";
import { planPayReady, planPayTest, rz } from "@/lib/server/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({ online: planPayReady(), test: planPayReady() && planPayTest(), webhook: !!rz.webhookSecret });
}
