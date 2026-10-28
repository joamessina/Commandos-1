import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'tools/**', 'node_modules/**', 'research-c1/**'] },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    // Sin eslint-disable: una regla silenciada es deuda invisible (CONSTRAINTS.from-c2.md).
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
  },
  { files: ['*.config.ts', '*.config.js'], extends: [tseslint.configs.disableTypeChecked] },
);
