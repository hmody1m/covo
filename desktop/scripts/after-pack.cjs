// electron-builder afterPack hook: sets the Windows .exe icon and version info with
// resedit (pure JS), so Windows builds work from Linux/macOS CI without Wine.
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const R = ResEdit.default || ResEdit;
  const exe = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.exe`);
  const exeFile = R.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const rsrc = R.NtExecutableResource.from(exeFile);
  const ico = R.Data.IconFile.from(fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.ico')));
  const groups = R.Resource.IconGroupEntry.fromEntries(rsrc.entries);
  const groupId = groups.length ? groups[0].id : 1;
  const lang = groups.length ? groups[0].lang : 1033;
  R.Resource.IconGroupEntry.replaceIconsForResource(rsrc.entries, groupId, lang, ico.icons.map((i) => i.data));
  const [vi] = R.Resource.VersionInfo.fromEntries(rsrc.entries);
  if (vi) {
    const v = ctx.packager.appInfo.version.split('.').map(Number);
    vi.setFileVersion(v[0], v[1], v[2], 0, lang);
    vi.setProductVersion(v[0], v[1], v[2], 0, lang);
    vi.setStringValues({ lang, codepage: 1200 }, {
      ProductName: 'Covo', FileDescription: 'Covo', CompanyName: 'Covo contributors', OriginalFilename: 'Covo.exe', InternalName: 'Covo',
      LegalCopyright: 'MIT License — Covo contributors', ProductVersion: ctx.packager.appInfo.version, FileVersion: ctx.packager.appInfo.version,
    });
    vi.outputToResourceEntries(rsrc.entries);
  }
  rsrc.outputResource(exeFile);
  fs.writeFileSync(exe, Buffer.from(exeFile.generate()));
  console.log('  • afterPack: icon + version info set on', path.basename(exe));
};
