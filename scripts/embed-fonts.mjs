import fs from 'fs';

const rosReg = fs.readFileSync('public/fonts/Roslindale-Regular.woff2').toString('base64');
const rosMed = fs.readFileSync('public/fonts/Roslindale-Medium.woff2').toString('base64');
const ayerMed = fs.readFileSync('public/fonts/Ayer-Medium.woff2').toString('base64');

const css = `/* Embedded zero-latency web fonts to prevent cold-start layout shift / font swap */
@font-face {
  font-family: 'Roslindale Display Condensed';
  src: url('data:font/woff2;base64,${rosReg}') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Roslindale Display Condensed';
  src: url('data:font/woff2;base64,${rosMed}') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Ayer';
  src: url('data:font/woff2;base64,${ayerMed}') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
`;

fs.writeFileSync('app/embedded-fonts.css', css, 'utf8');
console.log('Successfully generated app/embedded-fonts.css:', fs.statSync('app/embedded-fonts.css').size, 'bytes');
