/**
 * Nano ID generator for compact, unique IDs
 */

const urlAlphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
const random = bytes => crypto.getRandomValues(new Uint8Array(bytes));

function customAlphabet(alphabet, defaultSize = 21) {
  return (size = defaultSize) => {
    let id = '';
    let i = size;
    const bytes = random(size);
    while (i--) {
      id += alphabet[bytes[i] & 63];
    }
    return id;
  };
}

export { customAlphabet, urlAlphabet };
