import { instance } from "@viz-js/viz";
import "../styles.css";
import { DFA, FiniteAutomata, NFA, State } from "./automata";
import { debounce } from "./debounce";
import { parse } from "./parser";

const $ = document.getElementById.bind(document) as //
  (_: string) => HTMLElement;
const $$ = document.getElementsByClassName.bind(document) as //
  (_: string) => HTMLCollectionOf<HTMLElement>;


/**
 * Setup the UI necessary scripts.
 */


let activeAutomata: FiniteAutomata | undefined;
let activeRenameMap: Map<State, string> | undefined;

let globalGlushkovNfa: NFA | undefined;
let globalGlushkovRenameMap: Map<State, string> | undefined;
let globalThompsonNfa: NFA | undefined;
let globalThompsonRenameMap: Map<State, string> | undefined;
let globalDfa: DFA | undefined;
let globalDfaRenameMap: Map<State, string> | undefined;
let globalMinimalDfa: DFA | undefined;
let globalMinimalDfaRenameMap: Map<State, string> | undefined;


/**
 * Setup the automata.
 */

const viz = await instance();

const regexInput = $("regex-input") as HTMLInputElement;
const stringInput = $("string-input") as HTMLInputElement;
const recognizeOutput = $("match-result") as HTMLDivElement;

const dfaSwitch = $(`dfa-switch`) as HTMLInputElement;
const minimalDfaSwitch = $(`minimal-dfa-switch`) as HTMLInputElement;

/// Returns the rename map (State -> string) and SVG rendering.
///   This is quite slow, as it requires two passes.
const renderSvgElementForAutomata = (automata: FiniteAutomata)
  : [Map<State, string>, SVGSVGElement] => {
  const svgKey = viz.renderSVGElement(automata.dot({ blankStates: false }));

  const idMap = new Map<number, State>();
  const labelMap = new Map<number, Element>();
  const queue = [];
  const texts = [...svgKey.querySelectorAll(".node text")];
  for (const state of automata.states) {
    if (state.label == "") continue;

    const svgLabel = texts.filter(s => state.label == s.textContent)[0];
    const query = svgLabel
      .previousElementSibling
      .getAttribute("cx");

    const xPosition = parseInt(query);

    queue.push([state.id, xPosition]);
    labelMap.set(state.id, svgLabel);
    idMap.set(state.id, state);
  }

  queue.sort(([, a], [, b]) => b - a);
  const renameMap = new Map<State, string>();
  while (queue.length > 0) {
    const label = `q${renameMap.size + 1}`;
    const [stateId,] = queue.pop();
    queue.sort(([, a], [, b]) => b - a);

    renameMap.set(idMap.get(stateId), label);
  }

  const svgOutput = viz.renderSVGElement(automata.dot({ renames: renameMap }));

  return [renameMap, svgOutput];
}
const convert = debounce(() => {
  const regex = parse(regexInput.value);
  if (regex == null) return;

  const activeTab = document.querySelector(".tab-button.active").getAttribute("tab-id");
  console.log(activeTab);

  const glushkovNfa = NFA.fromGlushkovConstruction(regex);
  const [rename1, svg1] = renderSvgElementForAutomata(glushkovNfa);
  globalGlushkovNfa = glushkovNfa;
  globalGlushkovRenameMap = rename1;
  if (activeTab == "glushkov-nfa") {
    activeAutomata = glushkovNfa;
    activeRenameMap = rename1;
  }

  /// We remove the children forcefully.
  document.getElementById("graphviz-output-glushkov-nfa").innerHTML = "";
  document.getElementById("graphviz-output-glushkov-nfa").appendChild(svg1);

  const thompsonNfa = NFA.fromThompsonConstruction(regex);
  const [rename2, svg2] = renderSvgElementForAutomata(thompsonNfa);
  globalThompsonNfa = thompsonNfa;
  globalThompsonRenameMap = rename2;
  if (activeTab == "thompson-nfa") {
    activeAutomata = thompsonNfa;
    activeRenameMap = rename2;
  }

  /// We remove the children forcefully.
  document.getElementById("graphviz-output-thompson-nfa").innerHTML = "";
  document.getElementById("graphviz-output-thompson-nfa").appendChild(svg2);

  const dfa = glushkovNfa.toDFA({ includeDeadState: dfaSwitch.checked });
  const [rename3, svg3] = renderSvgElementForAutomata(dfa);
  globalDfa = dfa;
  globalDfaRenameMap = rename3;
  if (activeTab == "dfa") {
    activeAutomata = dfa;
    activeRenameMap = rename3;
  }

  document.getElementById("graphviz-output-dfa").innerHTML = "";
  document.getElementById("graphviz-output-dfa").appendChild(svg3);

  const minimalDfa = thompsonNfa.toDFA({ includeDeadState: minimalDfaSwitch.checked }).minimized();
  const [rename4, svg4] = renderSvgElementForAutomata(minimalDfa);
  globalMinimalDfa = minimalDfa;
  globalMinimalDfaRenameMap = rename4;
  if (activeTab == "minimal-dfa") {
    activeAutomata = minimalDfa;
    activeRenameMap = rename4;
  }

  document.getElementById("graphviz-output-minimal-dfa").innerHTML = "";
  document.getElementById("graphviz-output-minimal-dfa").appendChild(svg4);
}, 250);

const match = debounce(() => {
  const input = stringInput.value;

  if (activeAutomata == null || activeRenameMap == null) return;
  if (input.length <= 0) return;

  if (activeAutomata instanceof NFA) {
    const [states, accepts] = activeAutomata.acceptsDetailed(input);
    if (accepts) {
      recognizeOutput.textContent = "Recognized.";

      recognizeOutput.classList.add("success");
      recognizeOutput.classList.remove("failure");
    } else {
      const currentStates = [...states].map((s) => activeRenameMap.get(s)).join(", ");

      recognizeOutput.textContent = `String not accepted. Ending states = {${currentStates}}`;
      recognizeOutput.classList.add("failure");
      recognizeOutput.classList.remove("success");
    }
  } else if (activeAutomata instanceof DFA) {
    const [state, accepts] = activeAutomata.acceptsDetailed(input);
    if (accepts) {
      recognizeOutput.textContent = "Recognized.";

      recognizeOutput.classList.add("success");
      recognizeOutput.classList.remove("failure");
    } else {
      const currentState = activeRenameMap.get(state) || "∅";

      recognizeOutput.textContent = `String not accepted. Last state = ${currentState}`;
      recognizeOutput.classList.add("failure");
      recognizeOutput.classList.remove("success");
    }
  }
}, 250);

const swapText = debounce((idPrefix: string) => {
  const messageSpan = $(`${idPrefix}-switch-indicator`);
  const switchElement = $(`${idPrefix}-switch`) as HTMLInputElement;

  if (switchElement.checked) {
    messageSpan.textContent = "including Trap State";
  } else {
    messageSpan.textContent = "excluding Trap State";
  }

  convert();
}, 5);

regexInput.addEventListener("input", convert);
regexInput.addEventListener("input", match);
stringInput.addEventListener("input", match);
dfaSwitch.addEventListener("change", (_) => swapText("dfa"));
minimalDfaSwitch.addEventListener("change", (_) => swapText("minimal-dfa"));

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

    if (id == "glushkov-nfa") {
      activeAutomata = globalGlushkovNfa;
      activeRenameMap = globalGlushkovRenameMap;
    } else if (id == "thompson-nfa") {
      activeAutomata = globalThompsonNfa;
      activeRenameMap = globalThompsonRenameMap;
    } else if (id == "dfa") {
      activeAutomata = globalDfa;
      activeRenameMap = globalDfaRenameMap;
    } else if (id == "minimal-dfa") {
      activeAutomata = globalMinimalDfa;
      activeRenameMap = globalMinimalDfaRenameMap;
    }
    match();
  }.bind(button));
}