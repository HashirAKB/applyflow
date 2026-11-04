// Read a resume file in the browser. PDF via pdf.js (its worker ships inside the extension),
// DOCX via mammoth. The file never leaves the machine.
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import { pdfItemsToText } from '../core/resume';
import { toBase64 } from '../core/crypto';
import type { ResumeFile } from '../core/messages';

pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');

export async function resumeText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      pages.push(pdfItemsToText(content.items as { str: string; transform: number[] }[]));
    }
    return pages.join('\n');
  }
  if (/\.docx$/i.test(file.name)) {
    return (await mammoth.extractRawText({ arrayBuffer: buf })).value;
  }
  throw new Error('Please choose a PDF or DOCX file.');
}

export async function toResumeFile(file: File): Promise<ResumeFile> {
  return { name: file.name, type: file.type || 'application/octet-stream', base64: toBase64(new Uint8Array(await file.arrayBuffer())) };
}
