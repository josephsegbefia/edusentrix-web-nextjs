import { Application, type IApplication } from "@/models/Application";

type ApplicationAdminNames = Pick<
  IApplication,
  "adminFirstName" | "adminLastName"
>;

/**
 * When the local user record has no first/last name, pull from the latest
 * platform school application submitted with the same admin email (enrol form).
 */
export async function enrichUserNamesFromApplication(
  email: string,
  firstName: string | null | undefined,
  lastName: string | null | undefined
): Promise<{ firstName: string; lastName: string }> {
  let fn = (firstName ?? "").trim();
  let ln = (lastName ?? "").trim();
  if (fn && ln) return { firstName: fn, lastName: ln };

  const normalized = email.toLowerCase().trim();
  if (!normalized) return { firstName: fn, lastName: ln };

  const app = await Application.findOne({ adminEmail: normalized })
    .sort({ createdAt: -1 })
    .select("adminFirstName adminLastName")
    .lean<ApplicationAdminNames | null>();

  if (!app) return { firstName: fn, lastName: ln };
  if (!fn && app.adminFirstName) fn = app.adminFirstName.trim();
  if (!ln && app.adminLastName) ln = app.adminLastName.trim();

  return { firstName: fn, lastName: ln };
}
