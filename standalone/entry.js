// Browser edition entry: boots the unmodified Covo server core inside the page.
// Built by scripts/build-web.mjs into dist/web/js/local/covo-local.js.
import { fsReady, flushNow, fileBlobUrl, writeFileSync, existsSync } from './shims/fs.js';

export async function boot() {
  await fsReady();
  writeFileSync('/app/package.json', JSON.stringify({ name: 'covo', version: __COVO_VERSION__ }));
  const firstRun = !existsSync('/app/data/settings.json');
  const config = await import('../server/config.js');
  if (firstRun) {
    config.updateSettings({
      tools: { serverExecution: false, builtins: { shell: false, files: false, device: false } },
      notifications: { webPush: false },
    });
  }
  const [{ router, bootstrap }, { bus }, { startScheduler }] = await Promise.all([
    import('../server/routes.js'), import('../server/bus.js'), import('../server/scheduler.js'),
  ]);
  startScheduler();
  return {
    router, bootstrap, bus, config, flush: flushNow,
    fileUrl: (file, type) => fileBlobUrl('/app/data/uploads/' + file, type),
  };
}
