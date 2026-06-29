# Documentation rules

These rules apply to the postmerkOS UI repository.

1. Active documentation describes only behavior implemented by the latest source revision and uses present tense.
2. Put old releases, incident reports, migrations, removed behavior, and root-cause narratives under `docs/history/`.
3. Keep `README.md` limited to project identification, development onboarding, required validation, and links into `docs/`.
4. Put complete user behavior in `docs/user-guide/`, implementation contracts in `docs/development/` or `docs/modules/`, and avoid duplicating long explanations.
5. Update user, module, backend-contract, accessibility/responsive, and history documentation whenever related source behavior changes.
6. Document configd as the authorization and validation authority; never imply that hidden UI controls provide security.
7. Keep examples compatible with the current `package.json`, Node engine, Vite build, and `configd-ws` protocol.
8. Do not document secrets, private keys, credentials, or unredacted device/customer data.
9. Add every active document to `docs/README.md` and preserve relative-link integrity.
10. Run `npm run docs:check`, `npm run lint`, `npm test`, and `npm run build` before release.
