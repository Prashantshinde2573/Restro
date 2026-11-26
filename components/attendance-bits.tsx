import { L } from "@/lib/i18n";
import { Pill } from "./ui";
import type { Attendance } from "@/lib/payroll-math";

export const StatusPill = ({ a }: { a: Pick<Attendance, "status"> }) =>
  a.status === "approved" ? <Pill tone="jade">{L("Approved")}</Pill> : a.status === "rejected" ? <Pill tone="rose">{L("Not approved")}</Pill> : <Pill tone="saffron">{L("Waiting")}</Pill>;
