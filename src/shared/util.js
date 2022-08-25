/**
 * Returns the name of the type of the given value.
 *
 * @param {unknown} obj
 * @returns {string}
 * @example
 * type(null)      === 'Null'
 * type(undefined) === 'Undefined'
 * type(123)       === 'Number'
 * type('foo')     === 'String'
 * type(true)      === 'Boolean'
 * type([1, 2])    === 'Array'
 * type({})        === 'Object'
 * type(String)    === 'Function'
 * type(/abc+/)    === 'RegExp'
 */
function getType(obj) {
	return Object.prototype.toString.call(obj).slice(8, -1);
}

/**
 * @param {any} obj
 * @returns {obj is import("../types").PlainObject}
 */
function isPlainObject(obj) {
	return getType(obj) === 'Object';
}

/**
 * @param {Record<string | number, any>} obj
 * @param {(this: any, key: string, value: any, type: string) => void} callback
 * @param {string | null} [type]
 * @param {Set<unknown>} [visited]
 */
export function DFS(obj, callback, type, visited = new Set()) {
	for (let i in obj) {
		if (obj.hasOwnProperty(i)) {
			callback.call(obj, i, obj[i], type || i);

			let property = obj[i];
			if (!visited.has(property)) {
				if (isPlainObject(property)) {
					visited.add(property);
					DFS(property, callback, null, visited);
				} else if (Array.isArray(property)) {
					visited.add(property);
					DFS(property, callback, i, visited);
				}
			}
		}
	}
}

/**
 * @param {string} text
 * @returns {string}
 */
export function htmlEncode(text) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
}

/**
 * Creates a deep clone of the given object.
 *
 * The main intended use of this function is to clone language definitions.
 *
 * @param {T} o
 * @param {Map<any, any>} [mapping]
 * @returns {T}
 * @template T
 */
export function deepClone(o, mapping = new Map()) {
	const mapped = mapping.get(o);
	if (mapped) {
		return mapped;
	}

	if (isPlainObject(o)) {
		/** @type {Record<string, unknown>} */
		const clone = {};
		mapped.set(o, clone);

		for (let key in o) {
			if (o.hasOwnProperty(key)) {
				clone[key] = deepClone(o[key], mapping);
			}
		}

		return /** @type {any} */ (clone);
	} else if (Array.isArray(o)) {
		/** @type {unknown[]} */
		const clone = [];
		mapped.set(o, clone);

		o.forEach(function (v, i) {
			clone[i] = deepClone(v, mapping);
		});

		return /** @type {any} */ (clone);
	} else {
		return o;
	}
}