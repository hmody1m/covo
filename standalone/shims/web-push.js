// Web Push needs a server; the browser edition shows local notifications instead.
export default { generateVAPIDKeys: () => ({ publicKey: '', privateKey: '' }), setVapidDetails() {}, async sendNotification() {} };
