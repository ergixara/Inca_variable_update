export type SaveOutcome = "picker" | "share" | "popup" | "anchor" | "cancelled";

function isFramed(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

function safeFilename(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

async function saveWithPicker(blob: Blob, filename: string): Promise<boolean> {
  const picker = (
    window as Window & {
      showSaveFilePicker?: (opts: {
        suggestedName?: string;
        types?: { description: string; accept: Record<string, string[]> }[];
      }) => Promise<{
        createWritable: () => Promise<{
          write: (data: Blob) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }
  ).showSaveFilePicker;
  if (typeof picker !== "function") return false;

  const handle = await picker({
    suggestedName: filename,
    types: [
      {
        description: "INCA project",
        accept: {
          "application/octet-stream": [".prj"],
          "application/xml": [".prj", ".xml"],
        },
      },
    ],
  });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return true;
}

function clickAnchor(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_blank";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => a.remove(), 30_000);
}

function openPopupDownload(parentUrl: string, filename: string): boolean {
  const popup = window.open("about:blank", "_blank");
  if (!popup) {
    const alt = window.open(parentUrl, "_blank");
    return Boolean(alt);
  }
  try {
    const name = safeFilename(filename);
    popup.document.open();
    popup.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${name}</title>
<style>body{font:15px/1.4 system-ui,sans-serif;background:#0c0d0f;color:#ecece8;padding:40px}a{color:#0c0d0f;background:#d5d8de;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block}</style>
</head><body>
<p>Save your updated project:</p>
<p><a id="f" download="${name}" href="${parentUrl}">Download ${name}</a></p>
<script>
  const a = document.getElementById("f");
  a.click();
</script>
</body></html>`,
    );
    popup.document.close();
    return true;
  } catch {
    try {
      popup.location.href = parentUrl;
      return true;
    } catch {
      popup.close();
      return false;
    }
  }
}

/** Keep the blob URL alive — revoking in the same tick cancels the download. */
export async function saveTextFile(
  filename: string,
  contents: string,
): Promise<SaveOutcome> {
  const blob = new Blob([contents], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);

  const framed = isFramed();

  // Live preview is an iframe: <a download> is ignored and would navigate the app away.
  if (framed) {
    const opened = openPopupDownload(url, filename);
    clickAnchor(url, filename);
    return opened ? "popup" : "anchor";
  }

  try {
    if (await saveWithPicker(blob, filename)) return "picker";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
  }

  const file = new File([blob], filename, { type: "application/octet-stream" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };
  if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
    try {
      await nav.share?.({ files: [file], title: filename });
      return "share";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }

  clickAnchor(url, filename);
  return "anchor";
}
