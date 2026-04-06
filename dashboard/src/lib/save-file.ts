import { saveAs } from "file-saver";

export async function saveFile(blob: Blob, filename: string) {
  saveAs(blob, filename);
}
