// Opens the browser's file picker (web only). Resolves with null if it's
// closed without a file.
export function pickBrowserFile(accept?: string) {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
