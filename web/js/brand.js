// Project identity in one place. `node scripts/rename.mjs --name X --repo owner/repo` updates it.
export const BRAND = {
  name: 'Covo',
  repo: 'https://github.com/hmody1m/covo',
  tagline: 'Your open-source AI partner',
};
export const repoApi = () => BRAND.repo.replace('https://github.com/', 'https://api.github.com/repos/');
