// Turn each fetched report email into one item per attachment, ready for Unzip Reports.
// Unzip Reports reads binary "data" on every item and fails on anything that isn't an archive,
// so every item carries an archive there:
// - a .zip or .gz report goes in as-is;
// - a plain .xml report goes into json.xml, with an empty zip as "data" so it passes through;
// - a week with no reports still sends one item with an empty zip, so the summary still goes out
//   and says nothing arrived.
const EMPTY_ZIP = Buffer.from('504b0506' + '00'.repeat(18), 'hex');
const emptyZip = () => this.helpers.prepareBinaryData(EMPTY_ZIP, 'empty.zip', 'application/zip');

const out = [];
const items = $input.all();
for (let i = 0; i < items.length; i++) {
  for (const [key, bin] of Object.entries(items[i].binary || {})) {
    const name = String(bin.fileName || '').toLowerCase();
    if (/\.(zip|gz|gzip)$/.test(name)) {
      out.push({ json: { fileName: bin.fileName }, binary: { data: bin } });
    } else if (name.endsWith('.xml')) {
      const xml = (await this.helpers.getBinaryDataBuffer(i, key)).toString('utf8');
      out.push({ json: { fileName: bin.fileName, xml }, binary: { data: await emptyZip() } });
    }
  }
}
if (!out.length) out.push({ json: {}, binary: { data: await emptyZip() } });
return out;
