import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Application } from "@/models/Application";
import { sendEmail } from "@/lib/email/brevo";
import { requireRole } from "@/lib/auth/guards";

const BodySchema = z.object({
  adminFirstName: z.string().min(2),
  adminLastName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPhone: z.string().optional(),
  schoolName: z.string().min(3),
  schoolType: z.enum(["Basic", "Secondary"]),
  city: z.string().optional(),
  region: z.enum([
    "Ahafo",
    "Ashanti",
    "Bono",
    "Bono East",
    "Central",
    "Eastern",
    "Greater Accra",
    "North East",
    "Northern",
    "Oti",
    "Savannah",
    "Upper East",
    "Upper West",
    "Volta",
    "Western",
    "Western North",
  ]),
  message: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json();
  const body = BodySchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await connectToDatabase();

  const app = await Application.create({
    ...body.data,
    status: "submitted",
  });

  console.log(app);

  // Fire and forget OK for UX (await to stface errors during hardening)
  await sendEmail(`${app.adminEmail}`, "APPLICATION_RECEIVED", {
    name: `${app.adminFirstName}`,
  });

  return NextResponse.json({ success: true, id: app._id, app: app });
}
