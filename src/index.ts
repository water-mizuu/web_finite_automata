import { instance } from "@viz-js/viz";
import "../styles.css";
import { NFA } from "./automata";
import { debounce } from "./debounce";
import { parse } from "./parser";

const $ = document.getElementById.bind(document) as //
  (_: string) => HTMLElement;
const $$ = document.getElementsByClassName.bind(document) as //
  (_: string) => HTMLCollectionOf<HTMLElement>;

/**
 * Setup the UI necessary scripts.
 */

const tabButtons = $$("tab-button") as HTMLCollectionOf<HTMLButtonElement>;
for (const button of tabButtons) {
  button.addEventListener("click", function (this: HTMLButtonElement) {
    const id = this.getAttribute("tab-id");
    const tabContents = $$("tab-content") as HTMLCollectionOf<HTMLDivElement>;
    for (const tab of tabContents) {
      tab.style.display = "none";
    }

    const target = [...tabContents].filter(e => e.getAttribute("tab-id") == id)[0];
    target.style.display = "block";

    for (const button of tabButtons) {
      button.classList.remove("active");
    }
    this.classList.add("active");
  }.bind(button));
}

/**
 * Setup the automata.
 */

const viz = await instance();

const regexInput = $("regex-input") as HTMLInputElement;
const stringInput = $("string-input") as HTMLInputElement;
const recognizeOutput = $("match-result") as HTMLDivElement;

let globalNfa: NFA | undefined;
const convert = debounce(() => {
  const regex = parse(regexInput.value);
  if (regex == null) return;

  const nfa = NFA.fromGlushkovConstruction(regex);
  const svg1 = viz.renderSVGElement(nfa.dot({ blankStates: false }));

  /// We remove the children forcefully.
  document.getElementById("graphviz-output-glushkov-nfa").innerHTML = "";
  document.getElementById("graphviz-output-glushkov-nfa").appendChild(svg1);

  const nfa2 = NFA.fromThompsonConstruction(regex);
  const svg2 = viz.renderSVGElement(nfa2.dot({ blankStates: true }));

  console.log(nfa2);

  /// We remove the children forcefully.
  document.getElementById("graphviz-output-thompson-nfa").innerHTML = "";
  document.getElementById("graphviz-output-thompson-nfa").appendChild(svg2);

  const dfa = nfa.toDFA({ includeDeadState: true });
  const svg3 = viz.renderSVGElement(dfa.dot({ blankStates: true }));

  document.getElementById("graphviz-output-dfa").innerHTML = "";
  document.getElementById("graphviz-output-dfa").appendChild(svg3);

  const minimalDfa = dfa.minimized();
  const svg4 = viz.renderSVGElement(minimalDfa.dot({ blankStates: true }));

  document.getElementById("graphviz-output-minimal-dfa").innerHTML = "";
  document.getElementById("graphviz-output-minimal-dfa").appendChild(svg4);

  globalNfa = nfa;
}, 250);

const match = debounce(() => {
  const input = stringInput.value;

  if (globalNfa == null) return;
  if (input.length <= 0) return;

  const [states, accepts] = globalNfa.acceptsDetailed(input);
  if (accepts) {
    recognizeOutput.textContent = "Recognized.";
  } else {
    const currentStates = [...states].map((s) => s.label).join(", ");

    recognizeOutput.textContent = `String not accepted. Ending states = {${currentStates}}`;
  }
}, 250);

regexInput.addEventListener("input", convert);
regexInput.addEventListener("input", match);
stringInput.addEventListener("input", match);

