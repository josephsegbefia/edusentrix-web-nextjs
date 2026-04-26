// src/app/api/public/admissions/embed.js/route.ts
// Serves the small JS shim schools paste on their websites to embed an
// admissions application. Pairs with `PublicApplicationFlow` posting
// { type: "edusentrix:admissions:height", height } messages.

import { NextRequest } from "next/server";

export const dynamic = "force-static";

function buildScript(origin: string): string {
  return `// EduSentrix admissions embed widget
(function () {
  if (window.__edusentrixAdmissionsLoaded) return;
  window.__edusentrixAdmissionsLoaded = true;

  var ORIGIN = ${JSON.stringify(origin)};

  function mount(el) {
    if (!el || el.dataset.edusentrixMounted === "true") return;
    var schoolId = el.getAttribute("data-school-id");
    var slug = el.getAttribute("data-cycle-slug");
    if (!schoolId || !slug) {
      el.innerHTML = '<p style="color:#b91c1c;font:14px/1.5 system-ui">Missing data-school-id or data-cycle-slug.</p>';
      return;
    }
    var src = ORIGIN + "/apply/" + encodeURIComponent(schoolId) + "/" +
      encodeURIComponent(slug) + "?via=embed";
    var iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = "Admissions application";
    iframe.style.width = "100%";
    iframe.style.minHeight = "640px";
    iframe.style.border = "0";
    iframe.style.borderRadius = "16px";
    iframe.style.background = "#ffffff";
    iframe.style.boxShadow = "0 1px 2px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.08)";
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    el.dataset.edusentrixMounted = "true";
    el.appendChild(iframe);

    var instanceId = Math.random().toString(36).slice(2);
    iframe.dataset.edusentrixInstance = instanceId;

    function onMessage(event) {
      try {
        if (event.origin !== ORIGIN) return;
        var data = event.data;
        if (!data || typeof data !== "object") return;
        if (
          data.type !== "edusentrix:admissions:height" &&
          data.type !== "edusentrix:admissions:resize"
        ) return;
        var nextHeight = Number(data.height);
        if (!isFinite(nextHeight) || nextHeight < 200) return;
        iframe.style.height = nextHeight + "px";
      } catch (_) { /* ignore */ }
    }
    window.addEventListener("message", onMessage);
  }

  function init() {
    var nodes = document.querySelectorAll("[data-edusentrix-admissions]");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // Allow the host page to re-trigger after dynamic insertions.
  window.EduSentrixAdmissions = { mount: init };
})();
`;
}

function pickOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  if (env) return env.replace(/\/+$/, "");
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const origin = pickOrigin(req);
  const body = buildScript(origin);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
