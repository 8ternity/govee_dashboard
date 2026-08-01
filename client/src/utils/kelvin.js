/** Approximation visuelle pour l’aperçu UI (2700K–6500K, standards résidentiels). */
const KELVIN_HEX = {
  2700: '#ffb875',
  3000: '#ffd89a',
  4000: '#fff1db',
  5000: '#fffefb',
  6500: '#e8f4ff',
};

/* Algorithme Tanner Helland — conversion Kelvin → RGB pour toute température. */
function kelvinToRgb(kelvin) {
  const temp = kelvin / 100;
  let r;
  let g;
  let b;

  if (temp <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
  }

  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  }

  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

export function kelvinToHex(kelvin) {
  if (!kelvin) return '#ffffff';
  return KELVIN_HEX[kelvin] || rgbToHex(kelvinToRgb(kelvin));
}
