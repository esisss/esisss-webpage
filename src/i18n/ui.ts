import en from "./en.json";
import es from "./es.json";

export const defaultLocale = "en" as const;

export const ui = {
	en,
	es,
} as const;

export type Locale = keyof typeof ui;

type UnionToIntersection<T> = (
	T extends unknown
		? (value: T) => void
		: never
) extends (value: infer TIntersection) => void
	? TIntersection
	: never;

export type TranslationDictionary = UnionToIntersection<
	(typeof ui)[keyof typeof ui]
>;
