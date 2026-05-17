export async function GET() {
  return Response.json(
    {
      success: false,
      error: "Teacher notices have moved to the communications engine.",
      replacement: "/api/teacher/communications",
    },
    { status: 410 },
  );
}

export async function POST() {
  return Response.json(
    {
      success: false,
      error: "Teacher notices have moved to the communications engine.",
      replacement: "/api/teacher/communications",
    },
    { status: 410 },
  );
}
