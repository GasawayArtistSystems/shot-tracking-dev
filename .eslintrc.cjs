module.exports = {
    parser: "@babel/eslint-parser",
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
            jsx: true
        },
        requireConfigFile: false
    },
    env: {
        browser: true,
        es2021: true,
        node: true
    },
    plugins: ["react"],
    extends: [
        "eslint:recommended",
        "plugin:react/recommended"
    ],
    rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
        "no-undef": "off"
    },
    ignorePatterns: [
        "node_modules/",
        "build/",
        ".next/"
    ]
};
  