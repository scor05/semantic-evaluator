export function cartesianPower(
    values: string[],
    arity: number,
    limit = 12,
): string[][] {
    if (arity === 0) return [[]];
    if (values.length === 0) return [];

    const tuples: string[][] = [];
    const buildTuple = (tuple: string[]) => {
        if (tuples.length >= limit) return;
        if (tuple.length === arity) {
            tuples.push(tuple);
            return;
        }
        for (const value of values) {
            buildTuple([...tuple, value]);
            if (tuples.length >= limit) break;
        }
    };

    buildTuple([]);
    return tuples;
}
