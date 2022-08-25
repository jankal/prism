export default /** @type {import("../types").LanguageProto} */ ({
	id: 'bbcode',
	alias: 'shortcode',
	grammar: {
		'tag': {
			pattern: /\[\/?[^\s=\]]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'"\]=]+))?(?:\s+[^\s=\]]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'"\]=]+))*\s*\]/,
			inside: {
				'tag': {
					pattern: /^\[\/?[^\s=\]]+/,
					inside: {
						'punctuation': /^\[\/?/
					}
				},
				'attr-value': {
					pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'"\]=]+)/,
					inside: {
						'punctuation': [
							/^=/,
							{
								pattern: /^(\s*)["']|["']$/,
								lookbehind: true
							}
						]
					}
				},
				'punctuation': /\]/,
				'attr-name': /[^\s=\]]+/
			}
		}
	}
});