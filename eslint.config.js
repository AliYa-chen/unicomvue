import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,js,mjs,jsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  {
    name: 'app/browser-globals',
    files: ['src/**/*.{vue,js,mjs,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        __APP_BRANCH__: 'readonly',
        __APP_COMMIT__: 'readonly',
        __APP_BUILD_TIME__: 'readonly',
      },
    },
  },

  {
    name: 'app/node-globals',
    files: ['*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    name: 'app/vue-template-formatting',
    rules: {
      // Keep ESLint focused on correctness; the project does not use a template formatter.
      'vue/attributes-order': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/singleline-html-element-content-newline': 'off',
    },
  },

  ...pluginOxlint.configs['flat/recommended'],
])
