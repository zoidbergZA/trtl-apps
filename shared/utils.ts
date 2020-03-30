export function validateAppName(name: string): boolean {
  const regexp = '^[a-zA-Z0-9-_]+$';

  if (name.length > 24) {
    return false;
  }

  if (name.search(regexp) === -1) {
    return false;
  }

  return true;
}

export function validateQrName(name: string): boolean {
  const regexp = '^[a-zA-Z0-9-_ ]+$';

  if (name.length > 24) {
    return false;
  }

  if (name.search(regexp) === -1) {
    return false;
  }

  return true;
}
