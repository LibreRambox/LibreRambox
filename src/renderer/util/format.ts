export function formatNumber(n: number | string): string {
	return n.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
}

export function plural(count: number, singular: string, pluralForm: string): string {
	return count + ' ' + (count === 1 ? singular : pluralForm);
}

export function htmlEncode(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
