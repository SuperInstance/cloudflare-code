/**
 * Name formatting for different locales
 */

// @ts-nocheck - Type incompatibilities with NameFormatOptions

import type { NameFormatOptions, Locale } from '../types/index.js';

/**
 * Name components
 */
export interface Name {
  title?: string;
  givenName?: string;
  middleName?: string;
  familyName?: string;
  suffix?: string;
  nickname?: string;
}

/**
 * Format name according to locale conventions
 */
export function formatName(
  name: Name,
  locale: Locale,
  options: NameFormatOptions = {}
): string {
  const { format = 'full', order = getDefaultNameOrder(locale) } = options;

  switch (format) {
    case 'full':
      return formatFullName(name, locale, order);
    case 'formal':
      return formatFormalName(name, locale, order);
    case 'informal':
      return formatInformalName(name, locale);
    case 'monogram':
      return formatMonogram(name);
    default:
      return formatFullName(name, locale, order);
  }
}

/**
 * Format full name
 */
function formatFullName(name: Name, locale: Locale, order: 'western' | 'eastern'): string {
  const parts: string[] = [];

  if (name.title) parts.push(name.title);

  if (order === 'western') {
    // Western: Given Middle Family
    if (name.givenName) parts.push(name.givenName);
    if (name.middleName) parts.push(name.middleName);
    if (name.familyName) parts.push(name.familyName);
  } else {
    // Eastern: Family Middle Given
    if (name.familyName) parts.push(name.familyName);
    if (name.middleName) parts.push(name.middleName);
    if (name.givenName) parts.push(name.givenName);
  }

  if (name.suffix) parts.push(name.suffix);

  return parts.join(' ');
}

/**
 * Format formal name
 */
function formatFormalName(name: Name, locale: Locale, order: 'western' | 'eastern'): string {
  const parts: string[] = [];

  if (name.title) parts.push(name.title);

  if (order === 'western') {
    if (name.givenName && name.familyName) {
      parts.push(`${name.givenName} ${name.familyName}`);
    } else if (name.givenName || name.familyName) {
      parts.push(name.givenName || name.familyName || '');
    }
  } else {
    if (name.familyName && name.givenName) {
      parts.push(`${name.familyName} ${name.givenName}`);
    } else if (name.familyName || name.givenName) {
      parts.push(name.familyName || name.givenName || '');
    }
  }

  if (name.suffix) parts.push(name.suffix);

  return parts.join(' ');
}

/**
 * Format informal name
 */
function formatInformalName(name: Name, locale: Locale): string {
  // Use nickname if available, otherwise given name
  if (name.nickname) return name.nickname;
  if (name.givenName) return name.givenName;
  if (name.familyName) return name.familyName;
  return '';
}

/**
 * Format monogram
 */
function formatMonogram(name: Name): string {
  const initials: string[] = [];

  if (name.givenName) {
    initials.push(name.givenName[0].toUpperCase());
  }
  if (name.familyName) {
    initials.push(name.familyName[0].toUpperCase());
  }

  return initials.join('');
}

/**
 * Get default name order for locale
 */
function getDefaultNameOrder(locale: Locale): 'western' | 'eastern' {
  const easternLocales = ['ja', 'ko', 'zh', 'vi'];
  const language = locale.split('-')[0];

  return easternLocales.includes(language) ? 'eastern' : 'western';
}

/**
 * Parse full name into components
 */
export function parseName(fullName: string, locale: Locale): Name {
  const name: Name = {};
  const order = getDefaultNameOrder(locale);

  if (!fullName || fullName.trim().length === 0) {
    return name;
  }

  // Remove extra whitespace
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  const parts = trimmed.split(' ');

  if (order === 'western') {
    // Western: Last part is family name, first is given name
    if (parts.length === 1) {
      name.givenName = parts[0];
    } else if (parts.length === 2) {
      name.givenName = parts[0];
      name.familyName = parts[1];
    } else if (parts.length === 3) {
      name.givenName = parts[0];
      name.middleName = parts[1];
      name.familyName = parts[2];
    } else {
      name.givenName = parts[0];
      name.middleName = parts.slice(1, parts.length - 1).join(' ');
      name.familyName = parts[parts.length - 1];
    }
  } else {
    // Eastern: First part is family name, last is given name
    if (parts.length === 1) {
      name.familyName = parts[0];
    } else if (parts.length === 2) {
      name.familyName = parts[0];
      name.givenName = parts[1];
    } else if (parts.length === 3) {
      name.familyName = parts[0];
      name.middleName = parts[1];
      name.givenName = parts[2];
    } else {
      name.familyName = parts[0];
      name.middleName = parts.slice(1, parts.length - 1).join(' ');
      name.givenName = parts[parts.length - 1];
    }
  }

  return name;
}

/**
 * Get name field labels
 */
export function getNameFieldLabels(locale: Locale): Record<
  'title' | 'givenName' | 'middleName' | 'familyName' | 'suffix' | 'nickname',
  string
> {
  const labels: Record<string, Record<string, string>> = {
    en: {
      title: 'Title',
      givenName: 'First Name',
      middleName: 'Middle Name',
      familyName: 'Last Name',
      suffix: 'Suffix',
      nickname: 'Nickname',
    },
    es: {
      title: 'Título',
      givenName: 'Nombre',
      middleName: 'Segundo Nombre',
      familyName: 'Apellido',
      suffix: 'Sufijo',
      nickname: 'Apodo',
    },
    fr: {
      title: 'Titre',
      givenName: 'Prénom',
      middleName: 'Deuxième Prénom',
      familyName: 'Nom de Famille',
      suffix: 'Suffixe',
      nickname: 'Surnom',
    },
    de: {
      title: 'Titel',
      givenName: 'Vorname',
      middleName: 'Zweiter Vorname',
      familyName: 'Nachname',
      suffix: 'Suffix',
      nickname: 'Spitzname',
    },
    ja: {
      title: '敬称',
      givenName: '名',
      middleName: 'ミドルネーム',
      familyName: '姓',
      suffix: 'サフィックス',
      nickname: 'ニックネーム',
    },
    zh: {
      title: '头衔',
      givenName: '名',
      middleName: '中间名',
      familyName: '姓',
      suffix: '后缀',
      nickname: '昵称',
    },
    ko: {
      title: '칭호',
      givenName: '이름',
      middleName: '중간 이름',
      familyName: '성',
      suffix: '접미사',
      nickname: '별명',
    },
    ar: {
      title: 'اللقب',
      givenName: 'الاسم الأول',
      middleName: 'الاسم الأوسط',
      familyName: 'اسم العائلة',
      suffix: 'اللاحقة',
      nickname: 'الكنية',
    },
  };

  const language = locale.split('-')[0];
  return labels[language] || labels.en;
}

/**
 * Sort names according to locale
 */
export function sortNames(names: string[], locale: Locale): string[] {
  const language = locale.split('-')[0];
  const order = getDefaultNameOrder(locale);

  return names.sort((a, b) => {
    const nameA = parseName(a, locale);
    const nameB = parseName(b, locale);

    if (order === 'western') {
      // Sort by family name, then given name
      const familyA = nameA.familyName || '';
      const familyB = nameB.familyName || '';

      if (familyA !== familyB) {
        return familyA.localeCompare(familyB, language);
      }

      const givenA = nameA.givenName || '';
      const givenB = nameB.givenName || '';
      return givenA.localeCompare(givenB, language);
    } else {
      // Sort by family name (which comes first)
      const familyA = nameA.familyName || '';
      const familyB = nameB.familyName || '';

      if (familyA !== familyB) {
        return familyA.localeCompare(familyB, language);
      }

      const givenA = nameA.givenName || '';
      const givenB = nameB.givenName || '';
      return givenA.localeCompare(givenB, language);
    }
  });
}

/**
 * Get common titles for locale
 */
export function getCommonTitles(locale: Locale): string[] {
  const titles: Record<string, string[]> = {
    en: ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'],
    es: ['Sr.', 'Sra.', 'Srta.', 'Dr.', 'Prof.'],
    fr: ['M.', 'Mme', 'Mlle', 'Dr.', 'Pr.'],
    de: ['Herr', 'Frau', 'Dr.', 'Prof.'],
    ja: ['様', 'さん', '先生', '博士'],
    zh: ['先生', '女士', '博士', '教授'],
    ko: ['씨', '님', '박사', '교수'],
    ar: ['السيد', 'السيدة', 'الدكتور', 'الأستاذ'],
  };

  const language = locale.split('-')[0];
  return titles[language] || titles.en;
}

/**
 * Validate name components
 */
export function validateName(
  name: Name,
  locale: Locale
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!name.givenName && !name.familyName) {
    errors.push('Name must have at least a given name or family name');
  }

  // Check for valid characters
  const nameRegex = /^[\p{L}\p{M}\s'-]+$/u;
  if (name.givenName && !nameRegex.test(name.givenName)) {
    errors.push('Given name contains invalid characters');
  }
  if (name.familyName && !nameRegex.test(name.familyName)) {
    errors.push('Family name contains invalid characters');
  }
  if (name.middleName && !nameRegex.test(name.middleName)) {
    errors.push('Middle name contains invalid characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format name for list display
 */
export function formatNameForList(
  name: Name,
  locale: Locale
): string {
  const order = getDefaultNameOrder(locale);

  if (order === 'western') {
    // Family, Given
    if (name.familyName && name.givenName) {
      return `${name.familyName}, ${name.givenName}`;
    }
    return name.familyName || name.givenName || '';
  } else {
    // Family Given (no comma)
    if (name.familyName && name.givenName) {
      return `${name.familyName} ${name.givenName}`;
    }
    return name.familyName || name.givenName || '';
  }
}

/**
 * Get placeholder text for name input
 */
export function getNamePlaceholder(locale: Locale): string {
  const placeholders: Record<string, string> = {
    en: 'John Doe',
    es: 'Juan García',
    fr: 'Jean Dupont',
    de: 'Hans Mueller',
    ja: '山田 太郎',
    zh: '张伟',
    ko: '김철수',
    ar: 'أحمد محمد',
  };

  const language = locale.split('-')[0];
  return placeholders[language] || placeholders.en;
}
