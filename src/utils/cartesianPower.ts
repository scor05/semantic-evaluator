export function cartesianPower(
    values: string[],
    arity: number,
): string[][] {
    if (arity === 0) return [[]];
    if (values.length === 0) return [];

    const tuples: string[][] = [];
    const buildTuple = (tuple: string[]) => {
        if (tuple.length === arity) {
            tuples.push(tuple);
            return;
        }
        for (const value of values) {
            buildTuple([...tuple, value]);
        }
    };

    buildTuple([]);
    return tuples;
}
