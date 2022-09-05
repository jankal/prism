import { getParentPre, isActive } from '../../shared/dom-util';

/**
 * @param {string} str
 */
function tabLength(str) {
	let res = 0;
	for (let i = 0; i < str.length; ++i) {
		if (str.charCodeAt(i) == '\t'.charCodeAt(0)) {
			res += 3;
		}
	}
	return str.length + res;
}

/**
 * @typedef {{
 *   'break-lines': number,
 *   'indent': number,
 *   'left-trim': boolean,
 *   'remove-indent': boolean,
 *   'remove-initial-line-feed': boolean,
 *   'remove-trailing': boolean,
 *   'right-trim': boolean,
 *   'spaces-to-tabs': number,
 *   'tabs-to-spaces': number,
 * }} NormalizeWhitespaceDefaults
 */

/**
 * @type {readonly (keyof NormalizeWhitespaceDefaults)[]}
 */
const normalizationOrder = [
	'remove-trailing',
	'remove-indent',
	'left-trim',
	'right-trim',
	'break-lines',
	'indent',
	'remove-initial-line-feed',
	'tabs-to-spaces',
	'spaces-to-tabs',
];

/**
 * @typedef {T extends boolean ? 'boolean' : T extends number ? 'number' : string} Typeof
 * @template T
 */

/**
 * @type {Readonly<{ [K in keyof NormalizeWhitespaceDefaults]: Typeof<NormalizeWhitespaceDefaults[K]> }>}
 */
const settingsConfig = {
	'remove-trailing': 'boolean',
	'remove-indent': 'boolean',
	'left-trim': 'boolean',
	'right-trim': 'boolean',
	'break-lines': 'number',
	'indent': 'number',
	'remove-initial-line-feed': 'boolean',
	'tabs-to-spaces': 'number',
	'spaces-to-tabs': 'number',
};

/**
 * Reads normalizations settings from the given elements's `data-*` attributes.
 *
 * @param {Element} element
 * @returns {Partial<NormalizeWhitespaceDefaults>}
 */
function readSetting(element) {
	/** @type {Partial<NormalizeWhitespaceDefaults>} */
	const settings = {};
	for (const key of normalizationOrder) {
		const attr = element.getAttribute('data-' + key);
		const type = settingsConfig[key];
		if (attr !== null) {
			try {
				const value = JSON.parse(attr || 'true');
				if (typeof value === type) {
					settings[key] = value;
				}
			} catch {
				// ignore error
			}
		}
	}
	return settings;
}

/**
 * @type {{ [K in keyof NormalizeWhitespaceDefaults]: (input: string, value: NormalizeWhitespaceDefaults[K]) => string }}
 */
const normalizationMethods = {
	'left-trim': (input) => input.replace(/^\s+/, ''),
	'right-trim': (input) => input.replace(/(^|\S)\s+$/, '$1'),
	'tabs-to-spaces': (input, spaces) => input.replace(/\t/g, ' '.repeat(spaces)),
	'spaces-to-tabs': (input, spaces) => input.replace(RegExp(' {' + spaces + '}', 'g'), '\t'),
	'remove-trailing': (input) => input.replace(/\s*?$/gm, ''),
	'remove-initial-line-feed': (input) => input.replace(/^(?:\r?\n|\r)/, ''),
	'remove-indent': (input) => {
		const indents = input.match(/^[^\S\n\r]*(?=\S)/gm);

		if (!indents || !indents[0].length) {
			return input;
		}

		indents.sort((a, b) => a.length - b.length);

		if (!indents[0].length) {
			return input;
		}

		return input.replace(RegExp('^' + indents[0], 'gm'), '');
	},
	'indent': (input, tabs) => input.replace(/^[^\S\n\r]*(?=\S)/gm, '\t'.repeat(tabs) + '$&'),
	'break-lines': (input, characters) => {
		const lines = input.split('\n');
		for (let i = 0; i < lines.length; ++i) {
			if (tabLength(lines[i]) <= characters) {
				continue;
			}

			const line = lines[i].split(/(\s+)/g);
			let len = 0;

			for (let j = 0; j < line.length; ++j) {
				const tl = tabLength(line[j]);
				len += tl;
				if (len > characters) {
					line[j] = '\n' + line[j];
					len = tl;
				}
			}
			lines[i] = line.join('');
		}
		return lines.join('\n');
	}
};

export class NormalizeWhitespace {
	/**
	 * @param {Partial<Readonly<NormalizeWhitespaceDefaults>>} defaults
	 */
	constructor(defaults) {
		/**
		 * @type {Partial<NormalizeWhitespaceDefaults>}
		 */
		this.defaults = { ...defaults };
	}

	/**
	 * @param {Partial<Readonly<NormalizeWhitespaceDefaults>>} defaults
	 */
	setDefaults(defaults) {
		Object.assign(this.defaults, defaults);
	}

	/**
	 * @param {string} input
	 * @param {Partial<Readonly<NormalizeWhitespaceDefaults>>} [settings]
	 */
	normalize(input, settings) {
		settings = { ...this.defaults, ...settings };

		for (const name of normalizationOrder) {
			const value = settings[name];
			if (value !== undefined && value !== false) {
				input = normalizationMethods[name](input, /** @type {never} */ (value));
			}
		}

		return input;
	}
}

export default /** @type {import("../../types").PluginProto<'normalize-whitespace'>} */ ({
	id: 'normalize-whitespace',
	optional: 'unescaped-markup',
	plugin() {
		return new NormalizeWhitespace({
			'remove-trailing': true,
			'remove-indent': true,
			'left-trim': true,
			'right-trim': true,
			/*'break-lines': 80,
				'indent': 2,
				'remove-initial-line-feed': false,
				'tabs-to-spaces': 4,
				'spaces-to-tabs': 4*/
		});
	},
	effect(Prism) {
		const Normalizer = Prism.plugins.normalizeWhitespace;

		return Prism.hooks.add('before-sanity-check', (env) => {
			if (!env.code) {
				return;
			}

			// Check classes
			if (!isActive(env.element, 'whitespace-normalization', true)) {
				return;
			}

			// Simple mode if there is no env.element
			if (!env.element.parentNode) {
				env.code = Normalizer.normalize(env.code);
				return;
			}

			// Normal mode
			const pre = getParentPre(env.element);
			if (!pre) {
				return;
			}

			const settings = readSetting(pre);

			const children = pre.childNodes;
			let before = '';
			let after = '';
			let codeFound = false;

			// Move surrounding whitespace from the <pre> tag into the <code> tag
			for (let i = 0; i < children.length; ++i) {
				const node = children[i];

				if (node == env.element) {
					codeFound = true;
				} else if (node.nodeName === '#text') {
					if (codeFound) {
						after += node.nodeValue;
					} else {
						before += node.nodeValue;
					}

					pre.removeChild(node);
					--i;
				}
			}

			if (!env.element.children.length || !Prism.components.has('keep-markup')) {
				env.code = before + env.code + after;
				env.code = Normalizer.normalize(env.code, settings);
			} else {
				// Preserve markup for keep-markup plugin
				const html = before + env.element.innerHTML + after;
				env.element.innerHTML = Normalizer.normalize(html, settings);
				env.code = env.element.textContent || '';
			}
		});
	}
});
