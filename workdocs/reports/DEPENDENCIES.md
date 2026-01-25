# Dependencies

## Dependency tree
```sh
npm warn Expanding --prod to --production. This will stop working in the next major version of npm.
npm warn config production Use `--omit=dev` instead.
@decaf-ts/for-typeorm@0.2.24 /home/tvenceslau/local-workspace/decaf-ts/for-typeorm
├─┬ @decaf-ts/core@0.8.26
│ ├── @decaf-ts/db-decorators@0.8.16 deduped
│ ├── @decaf-ts/decoration@0.8.7 deduped
│ ├── @decaf-ts/decorator-validation@1.11.16 deduped
│ ├── @decaf-ts/injectable-decorators@1.9.10 deduped
│ └── @decaf-ts/transactional-decorators@0.3.5 deduped
├─┬ @decaf-ts/db-decorators@0.8.16
│ ├── @decaf-ts/decoration@0.8.7 deduped
│ ├── @decaf-ts/decorator-validation@1.11.16 deduped
│ ├── @decaf-ts/injectable-decorators@1.9.10 deduped
│ └── @decaf-ts/logging@0.10.8 deduped
├─┬ @decaf-ts/decoration@0.8.7
│ └── reflect-metadata@0.2.2
├─┬ @decaf-ts/decorator-validation@1.11.16
│ └── @decaf-ts/decoration@0.8.7 deduped
├─┬ @decaf-ts/injectable-decorators@1.9.10
│ └── @decaf-ts/decoration@0.8.7 deduped
├─┬ @decaf-ts/logging@0.10.8
│ ├─┬ pino@10.1.0
│ │ ├── @pinojs/redact@0.4.0
│ │ ├── atomic-sleep@1.0.0
│ │ ├── on-exit-leak-free@2.1.2
│ │ ├─┬ pino-abstract-transport@2.0.0
│ │ │ └── split2@4.2.0 deduped
│ │ ├── pino-std-serializers@7.0.0
│ │ ├── process-warning@5.0.0
│ │ ├── quick-format-unescaped@4.0.4
│ │ ├── real-require@0.2.0
│ │ ├── safe-stable-stringify@2.5.0
│ │ ├─┬ sonic-boom@4.2.0
│ │ │ └── atomic-sleep@1.0.0 deduped
│ │ └─┬ thread-stream@3.1.0
│ │   └── real-require@0.2.0 deduped
│ ├── styled-string-builder@1.5.1
│ ├── typed-object-accumulator@0.1.5
│ └─┬ winston@3.19.0
│   ├── @colors/colors@1.6.0
│   ├─┬ @dabh/diagnostics@2.0.8
│   │ ├─┬ @so-ric/colorspace@1.1.6
│   │ │ ├─┬ color@5.0.3
│   │ │ │ ├─┬ color-convert@3.1.3
│   │ │ │ │ └── color-name@2.1.0
│   │ │ │ └─┬ color-string@2.1.4
│   │ │ │   └── color-name@2.1.0
│   │ │ └── text-hex@1.0.0
│   │ ├── enabled@2.0.0
│   │ └── kuler@2.0.0
│   ├── async@3.2.6
│   ├── is-stream@2.0.1
│   ├─┬ logform@2.7.0
│   │ ├── @colors/colors@1.6.0 deduped
│   │ ├── @types/triple-beam@1.3.5
│   │ ├── fecha@4.2.3
│   │ ├── ms@2.1.3 deduped
│   │ ├── safe-stable-stringify@2.5.0 deduped
│   │ └── triple-beam@1.4.1 deduped
│   ├─┬ one-time@1.0.0
│   │ └── fn.name@1.1.0
│   ├─┬ readable-stream@3.6.2
│   │ ├── inherits@2.0.4 deduped
│   │ ├─┬ string_decoder@1.3.0
│   │ │ └── safe-buffer@5.2.1 deduped
│   │ └── util-deprecate@1.0.2
│   ├── safe-stable-stringify@2.5.0 deduped
│   ├── stack-trace@0.0.10
│   ├── triple-beam@1.4.1
│   └─┬ winston-transport@4.9.0
│     ├── logform@2.7.0 deduped
│     ├── readable-stream@3.6.2 deduped
│     └── triple-beam@1.4.1 deduped
├─┬ @decaf-ts/transactional-decorators@0.3.5
│ ├── @decaf-ts/db-decorators@0.8.16 deduped
│ ├── @decaf-ts/decoration@0.8.7 deduped
│ ├── @decaf-ts/decorator-validation@1.11.16 deduped
│ └── @decaf-ts/injectable-decorators@1.9.10 deduped
├─┬ pg@8.16.3
│ ├── pg-cloudflare@1.2.7
│ ├── pg-connection-string@2.9.1
│ ├── UNMET OPTIONAL DEPENDENCY pg-native@>=3.0.1
│ ├─┬ pg-pool@3.10.1
│ │ └── pg@8.16.3 deduped
│ ├── pg-protocol@1.10.3
│ ├─┬ pg-types@2.2.0
│ │ ├── pg-int8@1.0.1
│ │ ├── postgres-array@2.0.0
│ │ ├── postgres-bytea@1.0.1
│ │ ├── postgres-date@1.0.7
│ │ └─┬ postgres-interval@1.2.0
│ │   └── xtend@4.0.2
│ └─┬ pgpass@1.0.5
│   └── split2@4.2.0
└─┬ typeorm@0.3.28
  ├── UNMET OPTIONAL DEPENDENCY @google-cloud/spanner@^5.18.0 || ^6.0.0 || ^7.0.0 || ^8.0.0
  ├── UNMET OPTIONAL DEPENDENCY @sap/hana-client@^2.14.22
  ├── @sqltools/formatter@1.2.5
  ├── ansis@4.2.0
  ├── app-root-path@3.1.0
  ├── UNMET OPTIONAL DEPENDENCY better-sqlite3@^8.0.0 || ^9.0.0 || ^10.0.0 || ^11.0.0 || ^12.0.0
  ├─┬ buffer@6.0.3
  │ ├── base64-js@1.5.1
  │ └── ieee754@1.2.1
  ├── dayjs@1.11.19
  ├─┬ debug@4.4.3
  │ └── ms@2.1.3
  ├─┬ dedent@1.7.1
  │ └── UNMET OPTIONAL DEPENDENCY babel-plugin-macros@^3.1.0
  ├── dotenv@16.6.1
  ├─┬ glob@10.5.0
  │ ├─┬ foreground-child@3.3.1
  │ │ ├─┬ cross-spawn@7.0.6
  │ │ │ ├── path-key@3.1.1
  │ │ │ ├─┬ shebang-command@2.0.0
  │ │ │ │ └── shebang-regex@3.0.0
  │ │ │ └─┬ which@2.0.2
  │ │ │   └── isexe@2.0.0
  │ │ └── signal-exit@4.1.0
  │ ├─┬ jackspeak@3.4.3
  │ │ ├─┬ @isaacs/cliui@8.0.2
  │ │ │ ├─┬ string-width-cjs@npm:string-width@4.2.3
  │ │ │ │ ├── emoji-regex@8.0.0
  │ │ │ │ ├── is-fullwidth-code-point@3.0.0 deduped
  │ │ │ │ └─┬ strip-ansi@6.0.1
  │ │ │ │   └── ansi-regex@5.0.1
  │ │ │ ├─┬ string-width@5.1.2
  │ │ │ │ ├── eastasianwidth@0.2.0
  │ │ │ │ ├── emoji-regex@9.2.2
  │ │ │ │ └── strip-ansi@7.1.2 deduped
  │ │ │ ├─┬ strip-ansi-cjs@npm:strip-ansi@6.0.1
  │ │ │ │ └── ansi-regex@5.0.1
  │ │ │ ├─┬ strip-ansi@7.1.2
  │ │ │ │ └── ansi-regex@6.2.2
  │ │ │ ├─┬ wrap-ansi-cjs@npm:wrap-ansi@7.0.0
  │ │ │ │ ├── ansi-styles@4.3.0 deduped
  │ │ │ │ ├─┬ string-width@4.2.3
  │ │ │ │ │ ├── emoji-regex@8.0.0
  │ │ │ │ │ ├── is-fullwidth-code-point@3.0.0 deduped
  │ │ │ │ │ └── strip-ansi@6.0.1 deduped
  │ │ │ │ └─┬ strip-ansi@6.0.1
  │ │ │ │   └── ansi-regex@5.0.1
  │ │ │ └─┬ wrap-ansi@8.1.0
  │ │ │   ├── ansi-styles@6.2.3
  │ │ │   ├── string-width@5.1.2 deduped
  │ │ │   └── strip-ansi@7.1.2 deduped
  │ │ └── @pkgjs/parseargs@0.11.0
  │ ├─┬ minimatch@9.0.5
  │ │ └─┬ brace-expansion@2.0.2
  │ │   └── balanced-match@1.0.2
  │ ├── minipass@7.1.2
  │ ├── package-json-from-dist@1.0.1
  │ └─┬ path-scurry@1.11.1
  │   ├── lru-cache@10.4.3
  │   └── minipass@7.1.2 deduped
  ├── UNMET OPTIONAL DEPENDENCY ioredis@^5.0.4
  ├── UNMET OPTIONAL DEPENDENCY mongodb@^5.8.0 || ^6.0.0
  ├── UNMET OPTIONAL DEPENDENCY mssql@^9.1.1 || ^10.0.0 || ^11.0.0 || ^12.0.0
  ├── UNMET OPTIONAL DEPENDENCY mysql2@^2.2.5 || ^3.0.1
  ├── UNMET OPTIONAL DEPENDENCY oracledb@^6.3.0
  ├── UNMET OPTIONAL DEPENDENCY pg-native@^3.0.0
  ├── UNMET OPTIONAL DEPENDENCY pg-query-stream@^4.0.0
  ├── pg@8.16.3 deduped
  ├── UNMET OPTIONAL DEPENDENCY redis@^3.1.1 || ^4.0.0 || ^5.0.14
  ├── reflect-metadata@0.2.2 deduped
  ├─┬ sha.js@2.4.12
  │ ├── inherits@2.0.4
  │ ├── safe-buffer@5.2.1
  │ └─┬ to-buffer@1.2.2
  │   ├── isarray@2.0.5
  │   ├── safe-buffer@5.2.1 deduped
  │   └─┬ typed-array-buffer@1.0.3
  │     ├─┬ call-bound@1.0.4
  │     │ ├─┬ call-bind-apply-helpers@1.0.2
  │     │ │ ├── es-errors@1.3.0 deduped
  │     │ │ └── function-bind@1.1.2
  │     │ └─┬ get-intrinsic@1.3.0
  │     │   ├── call-bind-apply-helpers@1.0.2 deduped
  │     │   ├── es-define-property@1.0.1
  │     │   ├── es-errors@1.3.0 deduped
  │     │   ├─┬ es-object-atoms@1.1.1
  │     │   │ └── es-errors@1.3.0 deduped
  │     │   ├── function-bind@1.1.2 deduped
  │     │   ├─┬ get-proto@1.0.1
  │     │   │ ├─┬ dunder-proto@1.0.1
  │     │   │ │ ├── call-bind-apply-helpers@1.0.2 deduped
  │     │   │ │ ├── es-errors@1.3.0 deduped
  │     │   │ │ └── gopd@1.2.0 deduped
  │     │   │ └── es-object-atoms@1.1.1 deduped
  │     │   ├── gopd@1.2.0
  │     │   ├── has-symbols@1.1.0
  │     │   ├─┬ hasown@2.0.2
  │     │   │ └── function-bind@1.1.2 deduped
  │     │   └─┬ has-tostringtag@1.0.2
  │     │     └── has-symbols@1.1.0 deduped
  │     ├── es-errors@1.3.0
  │     └─┬ is-typed-array@1.1.15
  │       └─┬ which-typed-array@1.1.19
  │         ├─┬ available-typed-arrays@1.0.7
  │         │ └── possible-typed-array-names@1.1.0
  │         ├─┬ call-bound@1.0.8
  │         │ ├─┬ call-bind-apply-helpers@1.0.2 deduped
  │         │ ├─┬ es-define-property@1.0.1 deduped
  │         │ ├─┬ get-intrinsic@1.3.0 deduped
  │         │ └─┬ set-function-length@1.2.2
  │         │   ├─┬ define-data-property@1.1.4
  │         │   │ ├── es-define-property@1.0.1 deduped
  │         │   │ ├── es-errors@1.3.0 deduped
  │         │   │ └── gopd@1.2.0 deduped
  │         │   ├── es-errors@1.3.0 deduped
  │         │   ├── function-bind@1.1.2 deduped
  │         │   ├── get-intrinsic@1.3.0 deduped
  │         │   ├── gopd=1.2.0 deduped
  │         │   └─┬ has-property-descriptors@1.0.2
  │         │     └── es-define-property@1.0.1 deduped
  │         ├── call-bound@1.0.4 deduped
  │         ├─┬ for-each@0.3.5
  │         │ └── is-callable@1.2.7
  │         ├── get-proto@1.0.1 deduped
  │         ├── gopd@1.2.0 deduped
  │         └─┬ has-tostringtag@1.0.2
  │           └── has-symbols@1.1.0 deduped
  ├── sql-highlight@6.1.0
  ├── UNMET OPTIONAL DEPENDENCY sql.js@^1.4.0
  ├── UNMET OPTIONAL DEPENDENCY sqlite3@^5.0.3
  ├─┬ ts-node@10.9.2
  │ ├─┬ @cspotcode/source-map-support@0.8.1
  │ │ └─┬ @jridgewell/trace-mapping@0.3.9
  │ │   ├── @jridgewell/resolve-uri@3.1.2
  │ │   └── @jridgewell/sourcemap-codec@1.5.5
  │ ├── UNMET OPTIONAL DEPENDENCY @swc/core@>=1.2.50
  │ ├── UNMET OPTIONAL DEPENDENCY @swc/wasm@>=1.2.50
  │ ├── @tsconfig/node10@1.0.12
  │ ├── @tsconfig/node12@1.0.11
  │ ├── @tsconfig/node14@1.0.3
  │ ├── @tsconfig/node16@1.0.4
  │ ├─┬ @types/node@25.0.3
  │ │ └── undici-types@7.16.0
  │ ├─┬ acorn-walk@8.3.4
  │ │ └── acorn@8.15.0 deduped
  │ ├── acorn@8.15.0
  │ ├── arg@4.1.3
  │ ├── create-require@1.1.1
  │ ├── diff@4.0.4
  │ ├── make-error@1.3.6
  │ ├── typescript@5.9.3
  │ ├── v8-compile-cache-lib@3.0.1
  │ └── yn@3.1.1
  ├── tslib@2.8.1
  ├── UNMET OPTIONAL DEPENDENCY typeorm-aurora-data-api-driver@^2.0.0 || ^3.0.0
  ├── uuid@11.1.0
  └─┬ yargs@17.7.2
    ├─┬ cliui@8.0.1
    │ ├─┬ string-width@4.2.3
    │ │ ├── emoji-regex@8.0.0
    │ │ ├── is-fullwidth-code-point@3.0.0 deduped
    │ │ └─┬ strip-ansi@6.0.1
    │ │   └── ansi-regex@5.0.1
    │ ├─┬ strip-ansi@6.0.1
    │ │ └── ansi-regex@5.0.1
    │ └─┬ wrap-ansi@7.0.0
    │   ├─┬ ansi-styles@4.3.0
    │   │ └─┬ color-convert@2.0.1
    │   │   └── color-name@1.1.4
    │   ├── string-width@4.2.3 deduped
    │   └── strip-ansi@6.0.1 deduped
    ├── escalade@3.2.0
    ├── get-caller-file@2.0.5
    ├── require-directory@2.1.1
    ├─┬ string-width@4.2.3
    │ ├── emoji-regex@8.0.0
    │ ├── is-fullwidth-code-point@3.0.0
    │ └─┬ strip-ansi@6.0.1
    │   └── ansi-regex@5.0.1
    ├── y18n@5.0.8
    └── yargs-parser@21.1.1
```
## Audit report
```sh
npm audit --production
npm warn config production Use `--omit=dev` instead.
found 0 vulnerabilities
```
