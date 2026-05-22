const FILE_TYPES = {
  aac: 'audio/aac',
  abw: 'application/x-abiword',
  apng: 'image/apng',
  arc: 'application/x-freearc',
  avi: 'video/x-msvideo',
  avif: 'image/avif',
  azw: 'application/vnd.amazon.ebook',
  bin: 'application/octet-stream',
  bmp: 'image/bmp',
  bz: 'application/x-bzip',
  bz2: 'application/x-bzip2',
  cda: 'application/x-cdf',
  cjs: 'text/javascript',
  csh: 'application/x-csh',
  css: 'text/css',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  eot: 'application/vnd.ms-fontobject',
  epub: 'application/epub+zip',
  gz: 'application/gzip',
  gif: 'image/gif',
  htm: 'text/html',
  html: 'text/html',
  ico: 'image/vnd.microsoft.icon',
  ics: 'text/calendar',
  jar: 'application/java-archive',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'application/javascript',
  json: 'application/json',
  jsonld: 'application/ld+json',
  md: 'text/markdown',
  mid: 'audio/midi',
  midi: 'audio/midi',
  mjs: 'text/javascript',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  mpkg: 'application/vnd.apple.installer+xml',
  odp: 'application/vnd.oasis.opendocument.presentation',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odt: 'application/vnd.oasis.opendocument.text',
  oga: 'audio/ogg',
  ogv: 'video/ogg',
  ogx: 'application/ogg',
  opus: 'audio/ogg',
  otf: 'font/otf',
  png: 'image/png',
  pdf: 'application/pdf',
  php: 'application/x-httpd-php',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rar: 'application/vnd.rar',
  rtf: 'application/rtf',
  sh: 'application/x-sh',
  svg: 'image/svg+xml',
  swf: 'application/x-shockwave-flash',
  tar: 'application/x-tar',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  ts: 'text/plain',
  ttf: 'font/ttf',
  txt: 'text/plain',
  vsd: 'application/vnd.visio',
  wasm: 'application/wasm',
  wav: 'audio/x-wav',
  weba: 'audio/webm',
  webm: 'video/webm',
  webmanifest: 'application/manifest+json',
  webp: 'image/webp',
  wgsl: 'text/wgsl',
  woff: 'font/woff',
  woff2: 'font/woff2',
  xhtml: 'application/xhtml+xml',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xml: 'application/xml',
  xul: 'application/vnd.mozilla.xul+xml',
  zip: 'application/zip',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  '7z': 'application/x-7z-compressed',
};

const URL_CACHE = new Map<string, string>();

export class FileSystemFile {
  readonly handle: FileSystemFileHandle;

  constructor(handle: FileSystemFileHandle) {
    this.handle = handle;
  }

  get name(): string {
    return this.handle.name;
  }

  getFile(): Promise<File> {
    return this.handle.getFile();
  }

  async isSameFile(file: FileSystemFile): Promise<boolean> {
    return await this.handle.isSameEntry(file.handle);
  }

  async read(): Promise<string> {
    const file = await this.handle.getFile();
    return file.text();
  }

  async readJson<T = any>(): Promise<T> {
    const raw = await this.read();
    return JSON.parse(raw) as T;
  }

  async write(text: string): Promise<void> {
    const writable = await this.handle.createWritable();
    await writable.write(text);
    await writable.close();
  }

  async writeBinary(base64: string): Promise<void> {
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const writable = await this.handle.createWritable();
    await writable.write(binary);
    await writable.close();
  }

  async writeJson(content: any): Promise<void> {
    const raw = JSON.stringify(content);
    return this.write(raw);
  }

  async getUrl(): Promise<string> {
    if (URL_CACHE.has(this.handle.name)) URL.revokeObjectURL(URL_CACHE.get(this.handle.name)!);
    const file = await this.handle.getFile();
    const blob = new Blob([await file.arrayBuffer()], { type: this._resolveFileType(file.name) });
    const url = URL.createObjectURL(blob);
    URL_CACHE.set(this.handle.name, url);
    return url;
  }

  private _resolveFileType(name: string): string {
    const extension = name.split('.').pop();
    const type = FILE_TYPES[extension as keyof typeof FILE_TYPES];
    if (type) return type;
    return 'text/plain';
  }
}
