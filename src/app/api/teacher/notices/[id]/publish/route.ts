export async function POST() {
  return Response.json(
    {
      success: false,
      error: "Teacher notices have moved to the communications engine.",
      replacement: "/api/teacher/communications/:id/send",
    },
    { status: 410 },
  );
}
