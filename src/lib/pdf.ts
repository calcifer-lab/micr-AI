import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc =
  GlobalWorkerOptions.workerSrc ??
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js";

export async function extractTextFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  let textContent = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ("str" in item ? (item.str as string) : ""))
      .filter(Boolean);
    textContent += `\n\n[Page ${pageNumber}]\n${strings.join(" ")}`;
  }

  return textContent.trim();
}
