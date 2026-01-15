interface StemmerStep {
  suffix: string;
  condition?: (word: string) => boolean;
  replacement?: string;
}

export class Stemmer {
  private steps: StemmerStep[] = [
    { suffix: 'sses', replacement: 'ss' },
    { suffix: 'ies', replacement: 'i' },
    { suffix: 'ss', replacement: 'ss' },
    { suffix: 's', replacement: '' },
    { suffix: 'eed', replacement: 'ee' },
    { suffix: 'ed', condition: (word) => !word.endsWith('eed') },
    { suffix: 'ing', condition: (word) => !word.endsWith('eing') },
    { suffix: 'eedly', replacement: 'ee' },
    { suffix: 'ingly', replacement: '' },
    { suffix: 'edly', replacement: '' },
    { suffix: 'ative', replacement: '' },
    { suffix: 'ize', replacement: '' },
    { suffix: 'alize', replacement: '' },
    { suffix: 'iciti', replacement: 'ic' },
    { suffix: 'ical', replacement: 'ic' },
    { suffix: 'ality', replacement: 'al' },
    { suffix: 'ivity', replacement: 'ive' },
    { suffix: 'bility', replacement: 'ble' },
    { suffix: 'ness', replacement: '' },
    { suffix: 'ement', replacement: '' },
    { suffix: 'ment', replacement: '' },
    { suffix: 'ent', replacement: '' },
    { suffix: 'ion', condition: (word) => word.endsWith('s') || word.endsWith('t') },
    { suffix: 'ou', replacement: '' },
    { suffix: 'ism', replacement: '' },
    { suffix: 'ate', replacement: '' },
    { suffix: 'iti', replacement: 'ic' },
    { suffix: 'ous', replacement: '' },
    { suffix: 'ive', replacement: '' },
    { suffix: 'ize', replacement: '' },
    { suffix: 'al', replacement: '' },
    { suffix: 'er', replacement: '' },
    { suffix: 'ic', replacement: '' },
    { suffix: 'able', replacement: '' },
    { suffix: 'ible', replacement: '' },
    { suffix: 'ant', replacement: '' },
    { suffix: 'ement', replacement: '' },
    { suffix: 'ment', replacement: '' },
    { suffix: 'ent', replacement: '' },
    { suffix: 'ion', condition: (word) => word.endsWith('s') || word.endsWith('t') },
    { suffix: 'ou', replacement: '' },
    { suffix: 'ism', replacement: '' },
    { suffix: 'ate', replacement: '' },
    { suffix: 'iti', replacement: '' },
    { suffix: 'ous', replacement: '' },
    { suffix: 'ive', replacement: '' },
    { suffix: 'ize', representation: '' }
  ];

  stem(word: string): string {
    if (word.length <= 3) {
      return word;
    }

    let stemmed = word.toLowerCase();

    for (const step of this.steps) {
      if (stemmed.endsWith(step.suffix)) {
        if (!step.condition || step.condition(stemmed)) {
          stemmed = stemmed.slice(0, -step.suffix.length);
          if (step.replacement) {
            stemmed += step.replacement;
          }
          break;
        }
      }
    }

    return stemmed;
  }

  tokenizeAndStem(text: string): string[] {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    return words.map(word => this.stem(word));
  }
}

export const stemmer = new Stemmer();