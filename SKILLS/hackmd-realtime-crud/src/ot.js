import ot from '@hackmd/ot';

const { TextOperation } = ot;

export function replacementOperation(before, after) {
  let prefix = 0;
  const maximumPrefix = Math.min(before.length, after.length);
  while (prefix < maximumPrefix && before[prefix] === after[prefix]) prefix += 1;

  let suffix = 0;
  const maximumSuffix = Math.min(before.length - prefix, after.length - prefix);
  while (suffix < maximumSuffix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;

  const removed = before.length - prefix - suffix;
  const inserted = after.slice(prefix, after.length - suffix);
  const operation = new TextOperation();
  operation.retain(prefix);
  operation.insert(inserted);
  operation.delete(removed);
  operation.retain(suffix);
  return operation;
}

export function applyOperation(content, json) {
  return TextOperation.fromJSON(json).apply(content);
}

export function transformOperations(left, right) {
  return TextOperation.transform(TextOperation.fromJSON(left), TextOperation.fromJSON(right))
    .map((operation) => operation.toJSON());
}