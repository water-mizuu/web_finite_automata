
export const debounce = <T extends (...args: object[]) => void>(
  func: T,
  delay: number
): T => {
  let timeout: NodeJS.Timeout | null = null;

  return ((...args) => {
    if (timeout != null) clearTimeout(timeout);

    timeout = setTimeout(() => func(...args), delay);
  }) as T;
};
