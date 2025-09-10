import tailwindcss from '@tailwindcss/postcss';
import tailwindConfig from './tailwind.config.js';

export default {
  plugins: [
    tailwindcss(tailwindConfig),
  ],
};