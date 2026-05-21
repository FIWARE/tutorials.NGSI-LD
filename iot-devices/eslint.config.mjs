import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
    { ignores: ['dist/'] },
    tseslint.configs.recommended,
    {
        languageOptions: {
            globals: globals.node,
        },
        rules: {
            'valid-jsdoc': 'off',
            'no-shadow': 'off',
        },
    },
);
