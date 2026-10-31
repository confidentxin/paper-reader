import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;
export function loadPDF(data: Uint8Array) {
  const assets = new URL('./pdf-assets/', document.baseURI).href;
  return getDocument({ data, cMapUrl: `${assets}cmaps/`, cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`,
    useSystemFonts: true, enableXfa: false });
}
export function pdfError(error: unknown) {
  const name = (error as { name?: string })?.name;
  if (name === 'PasswordException') return '加密 PDF 暂不支持，请先在其他工具中解除密码后导入。';
  if (name === 'InvalidPDFException') return 'PDF 已损坏或格式不受支持。';
  return error instanceof Error ? error.message : String(error);
}
