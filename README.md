# FACT project page

Website: https://l-avenir.github.io/fact-project-page/

## Develop and deploy

```sh
npm ci
npm run dev
npm run build
```

Preview: http://localhost:4321/fact-project-page/

Push to `main` to deploy through `.github/workflows/astro.yml`.
Page content is in `src/paper.mdx`; web assets are in `src/assets/` and `public/media/`.
Only website source, configuration, and published media belong in this repository.
New media must be deliberately added with `git add -f public/media/<filename>`.

## Template attribution

Adapted from [Roman Hauksson-Neill’s project page template](https://research-template.roman.technology), originally based on [Eliahu Horwitz’s template](https://github.com/eliahuhorwitz/Academic-project-page-template) and [Nerfies](https://nerfies.github.io/).
Template licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Research content and media are separate from the template license.
