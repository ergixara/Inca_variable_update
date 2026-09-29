import { createFileRoute } from "@tanstack/react-router";

function safeFilename(raw: string) {
  const base = raw.replace(/[/\\]+/g, "").replace(/[^\w.\-]+/g, "_").slice(0, 180);
  return base.endsWith(".prj") || base.endsWith(".xml") ? base : `${base || "updated"}.prj`;
}

function disposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]+/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export const Route = createFileRoute("/api/prj-file")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const xml = String(form.get("xml") ?? "");
        if (!xml.includes("<PROJECT") && !xml.includes("paramRecord")) {
          return new Response("Not a .prj payload", { status: 400 });
        }
        if (xml.length > 25_000_000) {
          return new Response("File too large", { status: 413 });
        }
        const filename = safeFilename(String(form.get("filename") ?? "updated_INCAvar.prj"));
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": disposition(filename),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
