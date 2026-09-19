import { crc32 } from "node:zlib";

export const DOCUMENT_PREVIEW_MAX_BYTES = 15 * 1024 * 1024;
export const DOCUMENT_PREVIEW_FORMATS = ["pdf", "image", "text", "docx", "pptx", "xlsx"] as const;
export type PreviewCorpusFormat = (typeof DOCUMENT_PREVIEW_FORMATS)[number];
export type PreviewCorpusScenario = "basic" | "size_boundary";

export interface PreviewCorpusFixture {
  buffer: Buffer;
  format: PreviewCorpusFormat;
  mimeType: string;
  name: string;
  scenario: PreviewCorpusScenario;
}

const OFFICE_MIME_TYPES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;
const PACKAGE_RELATIONSHIPS = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_RELATIONSHIPS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const PREVIEW_TEXT = "Preview fixture\nDay 1: Delhi\nDay 2: Agra\n";
const RASTER_BYTES = {
  gif: "R0lGODlhEAAQAIAAAExpcShWjyH5BAUAAAAALAAAAAAQABAAAAIOjI+py+0Po5y02ouzPgUAOw==",
  jpeg: "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAQABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJ8AUj7/2Q==",
  png: "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGElEQVQokWPQCOsnCTGMaggbDSWN4Zo0AJwlDRBrMnTqAAAAAElFTkSuQmCC",
  webp: "UklGRjgAAABXRUJQVlA4ICwAAACwAQCdASoQABAAAUAmJaACdLoABDAAAP7yIl/8lP67vKLnu/7FnLYFiAAAAA==",
};

export function previewRasterFixtures(): PreviewCorpusFixture[] {
  return Object.entries(RASTER_BYTES).map(([extension, bytes]) => ({
    buffer: Buffer.from(bytes, "base64"),
    format: "image",
    mimeType: `image/${extension}`,
    name: `preview-raster.${extension}`,
    scenario: "basic",
  }));
}

// Stored ZIP members make both content and 15 MB boundaries deterministic without a fixture dependency.
function officeZip(entries: Record<string, string | Buffer>) {
  const chunks: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const [path, content] of Object.entries(entries)) {
    const name = Buffer.from(path);
    const bytes = Buffer.from(content);
    const checksum = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04_03_4b_50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, bytes);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02_01_4b_50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += local.length + name.length + bytes.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06_05_4b_50, 0);
  end.writeUInt16LE(directory.length / 2, 8);
  end.writeUInt16LE(directory.length / 2, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, central, end]);
}

function relationships(entries: [string, string, string][]) {
  return `${XML_HEADER}<Relationships xmlns="${PACKAGE_RELATIONSHIPS}">${entries.map(([id, type, target]) => `<Relationship Id="${id}" Type="${OFFICE_RELATIONSHIPS}/${type}" Target="${target}"/>`).join("")}</Relationships>`;
}

function officeEntries(format: "docx" | "pptx" | "xlsx") {
  const entries: Record<string, string | Buffer> = {};
  const contentTypes: [string, string][] = [];
  if (format === "docx") {
    entries["_rels/.rels"] = relationships([["rId1", "officeDocument", "word/document.xml"]]);
    entries["word/document.xml"] =
      `${XML_HEADER}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS}"><w:body><w:p><w:r><w:t>Preview fixture</w:t></w:r></w:p><w:p><w:r><w:br w:type="page"/><w:t>Second page</w:t></w:r></w:p><w:p><w:hyperlink r:id="rExternal"><w:r><w:t>External link</w:t></w:r></w:hyperlink></w:p><w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
    entries["word/_rels/document.xml.rels"] =
      `${XML_HEADER}<Relationships xmlns="${PACKAGE_RELATIONSHIPS}"><Relationship Id="rExternal" Type="${OFFICE_RELATIONSHIPS}/hyperlink" Target="https://document-preview.invalid/remote" TargetMode="External"/></Relationships>`;
    contentTypes.push(["/word/document.xml", "wordprocessingml.document.main"]);
  } else if (format === "pptx") {
    entries["_rels/.rels"] = relationships([["rId1", "officeDocument", "ppt/presentation.xml"]]);
    entries["ppt/presentation.xml"] =
      `${XML_HEADER}<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS}"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
    entries["ppt/_rels/presentation.xml.rels"] = relationships([
      ["rId1", "slide", "slides/slide1.xml"],
      ["rId2", "slide", "slides/slide2.xml"],
    ]);
    for (const [index, text] of ["Preview fixture", "Second slide"].entries()) {
      entries[`ppt/slides/slide${index + 1}.xml`] =
        `${XML_HEADER}<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Text"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="7315200" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2400"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
      contentTypes.push([`/ppt/slides/slide${index + 1}.xml`, "presentationml.slide"]);
    }
    contentTypes.push(["/ppt/presentation.xml", "presentationml.presentation.main"]);
  } else {
    entries["_rels/.rels"] = relationships([["rId1", "officeDocument", "xl/workbook.xml"]]);
    entries["xl/workbook.xml"] =
      `${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS}"><sheets><sheet name="Costs" sheetId="1" r:id="rId1"/><sheet name="Summary" sheetId="2" r:id="rId2"/></sheets></workbook>`;
    entries["xl/_rels/workbook.xml.rels"] = relationships([
      ["rId1", "worksheet", "worksheets/sheet1.xml"],
      ["rId2", "worksheet", "worksheets/sheet2.xml"],
    ]);
    entries["xl/worksheets/sheet1.xml"] =
      `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>10</v></c><c r="B1"><f>SUM(A1:A3)</f><v>1</v></c><c r="C1" t="inlineStr"><is><t>Preview fixture</t></is></c></row><row r="2"><c r="A2"><v>20</v></c><c r="B2"><f>WEBSERVICE(&quot;https://document-preview.invalid/data&quot;)</f><v>7</v></c></row><row r="3"><c r="A3"><v>30</v></c><c r="B3"><f>RAND()</f></c></row></sheetData></worksheet>`;
    entries["xl/worksheets/sheet2.xml"] =
      `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><f>AVERAGE(Costs!A1:A3)</f><v>1</v></c></row></sheetData></worksheet>`;
    contentTypes.push(["/xl/workbook.xml", "spreadsheetml.sheet.main"]);
    contentTypes.push(["/xl/worksheets/sheet1.xml", "spreadsheetml.worksheet"]);
    contentTypes.push(["/xl/worksheets/sheet2.xml", "spreadsheetml.worksheet"]);
  }
  entries["[Content_Types].xml"] =
    `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${contentTypes.map(([path, type]) => `<Override PartName="${path}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`).join("")}</Types>`;
  return entries;
}

function pngChunk(type: string, payload: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const body = Buffer.concat([Buffer.from(type), payload]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

function nativePdf(padding = 0) {
  let text = "%PDF-1.4\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...["Preview fixture", "Second page"].map((value) => {
      const stream = `BT /F1 24 Tf 72 700 Td (${value}) Tj ET`;
      return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    }),
  ];
  const offsets = [0];
  for (const [index, value] of objects.entries()) {
    offsets.push(text.length);
    text += `${index + 1} 0 obj\n${value}\nendobj\n`;
  }
  const xref = text.length;
  text += `xref\n0 8\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // ponytail: whitespace padding exercises the source-size boundary; representative layout stress requires a reviewed corpus.
  return Buffer.concat([Buffer.from(text), Buffer.alloc(padding, 32)]);
}

export function previewCorpusFixture(
  format: PreviewCorpusFormat,
  scenario: PreviewCorpusScenario = "basic"
): PreviewCorpusFixture {
  const target = scenario === "size_boundary" ? DOCUMENT_PREVIEW_MAX_BYTES : 0;
  let buffer: Buffer;
  let mimeType: string;
  let extension: string = format;
  if (format === "pdf") {
    buffer = nativePdf();
    buffer = nativePdf(Math.max(0, target - buffer.length));
    mimeType = "application/pdf";
  } else if (format === "text") {
    buffer = Buffer.from(PREVIEW_TEXT.padEnd(target, " "));
    mimeType = "text/plain";
    extension = "txt";
  } else if (format === "image") {
    buffer = Buffer.from(RASTER_BYTES.png, "base64");
    if (target) {
      const padding = pngChunk(
        "tEXt",
        Buffer.from("Fixture\0".padEnd(target - buffer.length - 12, " "))
      );
      buffer = Buffer.concat([buffer.subarray(0, -12), padding, buffer.subarray(-12)]);
    }
    mimeType = "image/png";
    extension = "png";
  } else {
    const entries = officeEntries(format);
    if (target) {
      entries["fixture-padding.xml"] = "";
      const overhead = officeZip(entries).length;
      entries["fixture-padding.xml"] = Buffer.from("<fixture/>".padEnd(target - overhead, " "));
    }
    buffer = officeZip(entries);
    mimeType = OFFICE_MIME_TYPES[format];
  }
  return { buffer, format, mimeType, name: `preview-${scenario}.${extension}`, scenario };
}

export function hostileOfficeFixture(kind: "corrupt" | "encrypted" | "expansion_limit") {
  const fixture = previewCorpusFixture("xlsx");
  fixture.name = `preview-${kind}.xlsx`;
  if (kind === "corrupt") {
    fixture.buffer = Buffer.from("PK\u0003\u0004corrupt synthetic archive");
  } else {
    const end = fixture.buffer.length - 22;
    const centralOffset = fixture.buffer.readUInt32LE(end + 16);
    if (kind === "encrypted") {
      fixture.buffer.writeUInt16LE(1, 6);
      fixture.buffer.writeUInt16LE(1, centralOffset + 8);
    } else {
      fixture.buffer.writeUInt32LE(64 * 1024 * 1024 + 1, centralOffset + 24);
    }
  }
  return fixture;
}
