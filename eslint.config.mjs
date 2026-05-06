import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: [".cache/**", "node_modules/**"] },
  { 
    files: ["**/*.{js,mjs,cjs}"], 
    plugins: { js }, 
    extends: ["js/recommended"], 
    languageOptions: { globals: {...globals.browser, ...globals.node, IMask: "readonly", fbq: "readonly", Chart: "readonly", google: "readonly", showToast: "readonly", API_BASE_URL: "readonly", io: "readonly", Cropper: "readonly", setupPasswordToggles: "readonly", clients: "readonly", flatpickr: "readonly"} },
    rules: { "no-unused-vars": "off", "no-useless-escape": "off", "no-empty": "off", "no-useless-assignment": "off", "no-undef": "off", "no-prototype-builtins": "off" }
    rules: { "no-unused-vars": "off", "no-useless-escape": "off", "no-empty": "off", "no-useless-assignment": "off", "no-undef": "off", "no-prototype-builtins": "off", "preserve-caught-error": "off" }
  },
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
]);
