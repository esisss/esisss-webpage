import {
	defaultLocale,
	type Locale,
	type TranslationDictionary,
	ui,
} from "./ui";

type Primitive = string | number | boolean | bigint | symbol | null | undefined;
type InterpolationValue = string | number | boolean;
type InterpolationValues = Record<string, InterpolationValue>;

type IsPlainObject<T> = T extends Primitive
	? false
	: T extends readonly unknown[]
		? false
		: T extends object
			? true
			: false;

type NestedPaths<T> = {
	[K in keyof T & string]: IsPlainObject<T[K]> extends true
		? K | `${K}.${NestedPaths<T[K]>}`
		: K;
}[keyof T & string];

type PathValue<T, TPath extends string> = TPath extends keyof T
	? T[TPath]
	: TPath extends `${infer THead}.${infer TTail}`
		? THead extends keyof T
			? PathValue<T[THead], TTail>
			: never
		: never;

export type TranslationKey = NestedPaths<TranslationDictionary>;
export type TranslationResult<TKey extends TranslationKey> = PathValue<
	TranslationDictionary,
	TKey
>;

export type TranslateFn = <TKey extends TranslationKey>(
	key: TKey,
	values?: InterpolationValues,
) => TranslationResult<TKey>;

function interpolate(template: string, values?: InterpolationValues) {
	if (!values) {
		return template;
	}

	return template.replace(/\{([^{}]+)\}/g, (match, token) => {
		const value = values[token.trim()];
		return value === undefined ? match : String(value);
	});
}

function getByPath<TDictionary extends object, TPath extends string>(
	dictionary: TDictionary,
	path: TPath,
): PathValue<TDictionary, TPath> | undefined {
	const dictionaryRecord = dictionary as Record<string, unknown>;

	if (Object.hasOwn(dictionaryRecord, path)) {
		return dictionaryRecord[path] as PathValue<TDictionary, TPath>;
	}

	const segments = path.split(".");
	let current: unknown = dictionaryRecord;

	for (const segment of segments) {
		if (!current || typeof current !== "object" || !(segment in current)) {
			return undefined;
		}

		current = (current as Record<string, unknown>)[segment];
	}

	return current as PathValue<TDictionary, TPath>;
}

export function createI18n(locale: Locale) {
	const dictionary = ui[locale];
	const fallbackDictionary = ui[defaultLocale];

	const t: TranslateFn = (key, values) => {
		const value =
			getByPath(dictionary, key) ?? getByPath(fallbackDictionary, key) ?? key;

		if (typeof value === "string") {
			return interpolate(value, values) as TranslationResult<typeof key>;
		}

		return value as TranslationResult<typeof key>;
	};

	return {
		locale,
		t,
	};
}
