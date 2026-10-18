exports.requirePlatformPermission = async function requirePlatformPermission(permission) {
  const state = globalThis.__platformSchoolActivationPermission;
  if (!state || !state.ok || state.permission !== permission) {
    return {
      ok: false,
      res: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    };
  }
  return { ok: true, actor: state.actor };
};
