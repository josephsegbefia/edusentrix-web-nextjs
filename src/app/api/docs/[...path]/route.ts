import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;

    // Join path array into a single path string
    const pathString = path.join("/");

    // Security: Prevent path traversal
    if (pathString.includes("..") || pathString.includes("\\")) {
      return new NextResponse("Invalid path", { status: 400 });
    }

    // Normalize path - ensure it ends with .md
    if (!pathString.endsWith(".md")) {
      return new NextResponse("Invalid file type", { status: 400 });
    }

    const filePath = join(process.cwd(), "content", "docs", pathString);

    try {
      const content = await readFile(filePath, "utf-8");
      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
        },
      });
    } catch (error) {
      console.error("File read error:", error);
      console.error("Attempted path:", filePath);
      console.error("Resolved path:", pathString);
      return new NextResponse(
        JSON.stringify({ error: "File not found", path: filePath }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error serving doc:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
