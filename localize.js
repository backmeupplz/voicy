/**
 * File to build localization files
 */

/** Dependencies */
const strings = require('./helpers/strings');
const fm = require('easy-file-manager');

const translations = strings().getTranslations();

fm.upload('/lozalizations/', 'strings.js', new Buffer(JSON.stringify(translations, null, 2)).toString('base64'), () => {});

const englishTranslations = Object.keys(translations).map(v => `${JSON.stringify(v)}`).join('\n\n');

fm.upload('/lozalizations/', 'strings.txt', new Buffer(englishTranslations).toString('base64'), () => {});
