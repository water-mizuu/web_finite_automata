import { instance } from "@viz-js/viz";
import { DFA, NFA } from "./automata";
import { parse } from "./parser";

const viz = await instance();

const regexInput = document.getElementById("regex-input") as HTMLInputElement;
const stringInput = document.getElementById("string-input") as HTMLInputElement;
const recognizeOutput = document.getElementById("match-result") as HTMLDivElement;

const debounce = <T extends (...args: object[]) => void>(func: T, delay: number): T => {
  let timeout: NodeJS.Timeout | null = null;

  return ((...args) => {
    if (timeout != null) clearTimeout(timeout);

    timeout = setTimeout(() => func(...args), delay);
  }) as T;
};

let nfa: NFA | undefined;
let dfa: DFA | undefined;

const convert = debounce(() => {
  const regex = parse(regexInput.value);
  if (regex == null) return;

  nfa = NFA.fromGlushkovConstruction(regex);
  const svg1 = viz.renderSVGElement(nfa.dot({ blankStates: false }));

  /// We remove the children forcefully.
  document.getElementById("graphviz-output-nfa").innerHTML = "";
  document.getElementById("graphviz-output-nfa").appendChild(svg1);

  dfa = nfa.toDFA({ includeDeadState: true }).minimized();
  const svg2 = viz.renderSVGElement(dfa.dot({ blankStates: true }));

  document.getElementById("graphviz-output-dfa").innerHTML = "";
  document.getElementById("graphviz-output-dfa").appendChild(svg2);
}, 250);

const match = debounce(() => {
  const input = stringInput.value;

  if (nfa == null) return;
  if (input.length <= 0) return;

  const [states, accepts] = nfa.acceptsDetailed(input);
  if (accepts) {
    recognizeOutput.textContent = "Recognized.";
  } else {
    const currentStates = [...states].map(s => s.label).join(", ");

    recognizeOutput.textContent = `String not accepted. Ending states = {${currentStates}}`;
  }
}, 250);

regexInput.addEventListener("input", convert);
regexInput.addEventListener("input", match);
stringInput.addEventListener("input", match);