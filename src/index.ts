import { instance } from "@viz-js/viz";
import { NFA } from "./automata";
import { parse } from "./parser";

const viz = await instance();

const textInput = document.getElementById("regex-input") as HTMLInputElement;

const debounce = <T extends () => void>(func: T, delay: number): T => {
  let timeout: NodeJS.Timeout | null = null;

  return ((...args) => {
    if (timeout != null) clearTimeout(timeout);

    timeout = setTimeout(() => func(...args), delay);
  }) as T;
};

const convert = debounce(() => {
  const regex = parse(textInput.value);
  if (regex == null) return;

  const nfa = NFA.fromGlushkovConstruction(regex);
  const svg = viz.renderSVGElement(nfa.dot());

  /// We remove the children forcefully.
  document.getElementById("graphviz-output").innerHTML = "";
  document.getElementById("graphviz-output").appendChild(svg);
}, 250);
textInput.addEventListener("input", convert);