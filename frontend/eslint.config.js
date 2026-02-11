import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";

export default [
  { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] }, // Añadir .ts y .tsx
  { languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended, // Configuración recomendada para TypeScript
  {
    files: ["**/*.{ts,tsx}"], // Aplicar reglas de React solo a archivos TS/TSX
    ...pluginReactConfig,
    rules: {
      "react/react-in-jsx-scope": "off", // Deshabilitar si se usa React 17+ JSX transform
      "react/prop-types": "off", // Deshabilitar prop-types en TypeScript
    },
  },
];