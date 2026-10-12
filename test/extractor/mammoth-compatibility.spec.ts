import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import * as mammoth from 'mammoth';

const mammothRequire = createRequire(require.resolve('mammoth'));
const JSZip = mammothRequire('jszip');

describe('Mammoth dependency compatibility', () => {
  it('retains CLI argument parsing with argparse 2', () => {
    const cli = path.join(path.dirname(require.resolve('mammoth/package.json')), 'bin/mammoth');
    const output = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
    expect(output).toContain('--output-format');
    expect(output).toContain('docx-path');
  });

  it('extracts actual DOCX text without mocking Mammoth', async () => {
    const zip = new JSZip();
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`
    );
    zip.file(
      'word/document.xml',
      `<?xml version="1.0"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body><w:p><w:r><w:t>Trabajo académico de prueba</w:t></w:r></w:p></w:body>
      </w:document>`
    );
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const result = await mammoth.extractRawText({ buffer });
    expect(result.value.trim()).toBe('Trabajo académico de prueba');
  });
});
