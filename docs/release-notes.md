# Release Notes

## 1.0.9

### Changed

- **New header by default.** The User Configs in `setup/configs` and in the `portfolioPkg` template package no longer set `headerComponent`, so the application renders ipa-core's new header alongside its new side navigation. To keep the template's own header, set `"headerComponent": "components/HeaderBar/HeaderBar"` in the User Config's `settings`.

## 1.0.8 (hotfix)

### Fixed

- **Login no longer loops.** Applications created on Twinit Platform 5.2 or later no longer get the implicit grant type, so the previous login kept redirecting without ever signing in. The template now uses ipa-core 3.0.91, which signs in with PKCE on the v2 OAuth endpoints.
- **Search panel crash.** The global filters read the scripts ipa-core loads from the User Config. They now share ipa-core's script engine, so the search panel no longer fails with `can't access property "filterRuleFns"`.

### Changed

- **New side navigation by default.** ipa-core 3.0.91 renders its new side navigation when a User Config names no `sidebarComponent`, which is the case for the template's configs. The header is unchanged, since the configs name their own. To keep the previous navigation, add `"sidebarComponent": "ClassicNav"` to the User Config's `settings`.
- **Platform libraries 5.2.** `@dtplatform/platform-api` is now `^5.2.1` and `@dtplatform/iaf-script-engine` is `~5.2.0`, the versions ipa-core 3.0.91 uses. `@invicara/ipa-core-mmv` resolves to 0.3.42. The overrides that held these at 4.6 are removed, and a `lodash-es` `^4.18.1` override is added, as platform-api 5.2 requires it.
- **Node.js 22.23.4.** An `.nvmrc` pins the build to Node.js 22.23.4, which includes the October 2026 Node.js security fixes.
