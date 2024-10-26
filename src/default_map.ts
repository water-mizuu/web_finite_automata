export class DefaultMap<K, V> implements Map<K, V> {
  #inner: Map<K, V>;

  constructor(public defaultValue: (key: K) => V) {
    this.#inner = new Map<K, V>();
  }

  clear(): void {
    this.#inner.clear();
  }

  delete(key: K): boolean {
    return this.#inner.delete(key);
  }

  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
    this.#inner.forEach(callbackfn, thisArg);
  }

  get(key: K): V {
    if (this.#inner.get(key) == null) {
      this.#inner.set(key, this.defaultValue(key));
    }

    return this.#inner.get(key)!;
  }

  has(key: K): boolean {
    return this.#inner.has(key);
  }

  set(key: K, value: V): this {
    this.#inner.set(key, value);

    return this;
  }

  get size(): number { return this.#inner.size; }

  entries(): MapIterator<[K, V]> {
    return this.#inner.entries();
  }

  keys(): MapIterator<K> {
    return this.#inner.keys();
  }

  values(): MapIterator<V> {
    return this.#inner.values();
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.#inner[Symbol.iterator]();
  }

  get [Symbol.toStringTag]() {
    return this.#inner[Symbol.toStringTag];
  }
}