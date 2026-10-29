export type DigitalPdfHandler = (blob: Blob, code: string, title: string, data: unknown) => Promise<void>
