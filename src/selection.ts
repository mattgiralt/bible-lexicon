import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

interface SourceApplication {
  name: string;
  bundleId?: string;
}

export function selectionScript(app: SourceApplication): string {
  const filter = app.bundleId ? { bundleIdentifier: app.bundleId } : { name: app.name };
  return `
const processes = Application("System Events").applicationProcesses.whose(${JSON.stringify(filter)})();
if (processes.length !== 1) throw new Error("Source application unavailable");
const element = processes[0].attributes.byName("AXFocusedUIElement").value();
JSON.stringify({
  text: element.attributes.byName("AXValue").value(),
  selected: element.attributes.byName("AXSelectedText").value(),
  range: element.attributes.byName("AXSelectedTextRange").value()
});
`;
}

export function validateSelection(payload: unknown) {
  if (!payload || typeof payload !== "object") return;
  const { text, selected, range } = payload as Record<string, unknown>;
  if (
    typeof text !== "string" ||
    typeof selected !== "string" ||
    !selected.trim() ||
    !Array.isArray(range) ||
    !Number.isSafeInteger(range[0]) ||
    range[0] < 0 ||
    !Number.isSafeInteger(range[1])
  )
    return;

  const [start, end] = range as [number, number];
  const positions = new Set<number>();
  if (end === selected.length) positions.add(start);
  // System Events exposes Byword ranges as one-based inclusive bounds.
  if (start > 0 && end - start + 1 === selected.length) positions.add(start - 1);
  const matches = [...positions].filter((pos) => text.slice(pos, pos + selected.length) === selected);
  if (matches.length === 1) return { text, selected, pos: matches[0] };
}

export async function readSelection(app: SourceApplication) {
  try {
    const { stdout } = await exec("/usr/bin/osascript", ["-l", "JavaScript", "-e", selectionScript(app)], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10000,
    });
    const selection = validateSelection(JSON.parse(stdout));
    if (selection) return selection;
  } catch (error) {
    if (String(error).includes("-1743")) {
      throw new Error(
        "Autorisez Raycast à contrôler System Events dans Réglages Système → Confidentialité et sécurité → Automatisation.",
      );
    }
  }
  throw new Error(
    `${app.name} ne fournit pas la citation avec la position de la sélection dans ce champ. Vérifiez les droits d’accessibilité de Raycast ou utilisez Recherche lexicale.`,
  );
}
