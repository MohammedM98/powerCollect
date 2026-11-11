/** An amount as the server sends it (a decimal string) or as a field holds it, possibly empty. */
export type Amount = number | string | null | undefined;

/** One choice of a select or chip row. */
export interface Option<Value extends string = string> {
    value: Value;
    label: string;
}
