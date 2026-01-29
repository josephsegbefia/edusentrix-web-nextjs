import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";
import { TeacherResource } from "@/models/TeacherResource";

const ResourceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  url: z.string().min(1).max(1000),
  type: z.enum(["link", "pdf", "video", "image", "doc", "slides", "other"]).default("link"),
  tags: z.array(z.string().max(40)).optional(),
});

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.resourcesView);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const type = searchParams.get("type");
    const tag = searchParams.get("tag");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(Number(limitParam), 1) : 100;

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    };

    if (type) query.type = type;
    if (tag) query.tags = tag;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const resources = await TeacherResource.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return Response.json({
      success: true,
      data: {
        resources: resources.map((resource) => ({
          id: String(resource._id),
          title: resource.title,
          description: resource.description || null,
          url: resource.url,
          type: resource.type,
          tags: resource.tags || [],
          createdAt: resource.createdAt ? resource.createdAt.toISOString() : null,
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load resources:", e);
    const message = e instanceof Error ? e.message : "Failed to load resources";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.resourcesView);

    const body = await req.json().catch(() => null);
    const parsed = ResourceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const resource = await TeacherResource.create({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      url: parsed.data.url,
      type: parsed.data.type,
      tags: parsed.data.tags || [],
    });

    return Response.json({
      success: true,
      data: {
        id: String(resource._id),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create resource:", e);
    const message = e instanceof Error ? e.message : "Failed to create resource";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
