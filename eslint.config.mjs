import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: [
      'dist/**/*',
      'docs/**/*',
      'xampp-infinityfree/**/*',
      'public/**/*',
      'node_modules/**/*',
      '.aistudio/**/*',
    ],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
