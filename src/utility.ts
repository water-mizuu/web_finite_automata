
export const $ = document.getElementById.bind(document) as //
  (_: string) => HTMLElement | null;
export const $$ = document.getElementsByClassName.bind(document) as //
  (_: string) => HTMLCollectionOf<HTMLElement>;

export const q$ = document.querySelector.bind(document) as <E extends Element = Element>(selectors: string) => E | null;
export const q$$ = document.querySelectorAll.bind(document) as <E extends Element = Element> (selectors: string) => NodeListOf<E>;