import { z } from "zod";

import { normalizeStudentId } from "@/lib/checkin";

// Zod schemas (§10). App-side validation is the only email-format check in
// the system — the attendance table requires submitted_email to be non-null
// but deliberately does not validate its shape.

export const checkinSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
  studentId: z
    .string()
    .trim()
    .min(1, "Student ID is required")
    .max(32, "Student ID is too long")
    // A raw ID of "-" or "  " passes the database's not-blank check but
    // normalizes to nothing, which would collide every such submission into
    // one phantom identity. Require at least two normalized characters.
    .refine((v) => normalizeStudentId(v).length >= 2, "Enter a valid student ID"),
  email: z
    .string()
    .trim()
    .max(254, "Email is too long")
    .pipe(z.email("Enter a valid email address")),
});

export type CheckinFields = z.infer<typeof checkinSchema>;
