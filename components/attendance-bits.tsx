import { Pill } from "./ui";
import type { Attendance } from "@/lib/payroll-math";

export const StatusPill = ({ a }: { a: Pick<Attendance, "status"> }) =>
  a.status === "approved" ? <Pill tone="jade">Approved</Pill> : a.status === "rejected" ? <Pill tone="rose">Not approved</Pill> : <Pill tone="saffron">Waiting</Pill>;
