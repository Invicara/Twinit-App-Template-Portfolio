export const defaultNumberFormat = { kind: 'plain', precision: 2 };

export function renderNumberPreview(val, nf, locale) {
    if (!nf) return String(val);

    const prec = nf.precision ?? (nf.kind === 'currency' ? 2 : nf.kind === 'percent' ? 2 : 3);

    if (nf.kind === 'currency') {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: nf.currency,
            currencySign: nf.style === 'accounting' ? 'accounting' : 'standard',
            minimumFractionDigits: prec,
            maximumFractionDigits: prec,
        }).format(val);
    }
    if (nf.kind === 'percent') {
        const displayed = (nf.multiplier ?? 1) === 1 ? val : val * (nf.multiplier ?? 1);
        return new Intl.NumberFormat(locale, {
            style: 'percent',
            minimumFractionDigits: prec,
            maximumFractionDigits: prec,
        }).format(displayed);
    }
    if (nf.kind === 'unit') {
        const base = new Intl.NumberFormat(locale, {
            minimumFractionDigits: prec,
            maximumFractionDigits: prec,
        }).format(val);
        const suffix = nf.unit === 'celsius' ? '°C'
            : nf.unit === 'fahrenheit' ? '°F'
                : nf.unit; // fallback
        return `${base} ${suffix}`;
    }
    // plain
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: prec,
        maximumFractionDigits: prec,
    }).format(val);
}
