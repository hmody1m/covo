// Small stand-ins for Node built-ins that the server code imports but the browser edition doesn't use.
export const os = {
  hostname: () => 'This device', platform: () => 'browser', homedir: () => '/app/home', tmpdir: () => '/tmp',
  userInfo: () => ({ username: 'you' }), cpus: () => Array.from({ length: navigator.hardwareConcurrency || 4 }, () => ({})),
  totalmem: () => (navigator.deviceMemory || 4) * 1e9, freemem: () => 0, uptime: () => performance.now() / 1000,
  release: () => '', arch: () => '', EOL: '\n',
};
export const notAvailable = () => { throw new Error('Not available in the browser edition — run Covo as a server or desktop app for this.'); };
