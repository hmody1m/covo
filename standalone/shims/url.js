export const fileURLToPath = (u) => new URL(String(u)).pathname;
export const pathToFileURL = (p) => new URL('file://' + p);
export const URL_ = URL;
export default { fileURLToPath, pathToFileURL };
