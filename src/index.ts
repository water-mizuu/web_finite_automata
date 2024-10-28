import { instance } from "@viz-js/viz";
import "../styles.css";
import { DFA, FiniteAutomata, NFA, State } from "./automata";
import { debounce } from "./debounce";
import {
  glushkovDfaSwitch,
  minimalDfaSwitch,
  recognizeOutput,
  regexInput,
  stringInput,
  thompsonDfaSwitch,
} from "./elements";
import { parse } from "./parser";
import { Id, simulation } from "./simulation";
import { $, $$, q$ } from "./utility";



/**
 * Setup the UI necessary scripts.
 */

let activeFiniteAutomata: Id = "glushkov-nfa";

let globalGlushkovNfa: NFA | undefined;
let globalGlushkovNfaRenameMap: Map<State, string> | undefined;
let globalThompsonNfa: NFA | undefined;
let globalThompsonNfaRenameMap: Map<State, string> | undefined;
let globalGlushkovDfa: DFA | undefined;
let globalGlushkovDfaRenameMap: Map<State, string> | undefined;
let globalThompsonDfa: DFA | undefined;
let globalThompsonDfaRenameMap: Map<State, string> | undefined;
let globalMinimalDfa: DFA | undefined;
let globalMinimalDfaRenameMap: Map<State, string> | undefined;


/**
 * Setup the automata.
 */

export const viz = await instance();

export const getActiveAutomata = (): [Map<State, string>, FiniteAutomata] | [null, null] => {
  if (activeFiniteAutomata == null) {
    return [null, null];
  }

  let activeAutomata: FiniteAutomata;
  let activeRenameMap: Map<State, string>;
  switch (activeFiniteAutomata) {
    case "glushkov-nfa":
      activeAutomata = globalGlushkovNfa!;
      activeRenameMap = globalGlushkovNfaRenameMap!;
      break;
    case "thompson-nfa":
      activeAutomata = globalThompsonNfa!;
      activeRenameMap = globalThompsonNfaRenameMap!;
      break;

    case "glushkov-dfa":
      activeAutomata = globalGlushkovDfa!;
      activeRenameMap = globalGlushkovDfaRenameMap!;
      break;

    case "thompson-dfa":
      activeAutomata = globalThompsonDfa!;
      activeRenameMap = globalThompsonDfaRenameMap!;
      break;

    case "minimal-dfa":
      activeAutomata = globalMinimalDfa!;
      activeRenameMap = globalMinimalDfaRenameMap!;
      break;
  }

  return [activeRenameMap, activeAutomata];
}


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
      ?.previousElementSibling
      ?.getAttribute("cx");
    if (query == null) continue;

    const xPosition = parseInt(query);

    queue.push([state.id, xPosition]);
    labelMap.set(state.id, svgLabel);
    idMap.set(state.id, state);
  }

  queue.sort(([, a], [, b]) => b - a);
  const renameMap = new Map<State, string>();
  while (queue.length > 0) {
    const label = `q${renameMap.size + 1}`;
    const [stateId,] = queue.pop()!;
    queue.sort(([, a], [, b]) => b - a);

    renameMap.set(idMap.get(stateId)!, label);
  }

  const svgOutput = viz.renderSVGElement(automata.dot({ blankStates: false }));

  return [renameMap, svgOutput];
};

/**
 * SIMULATION:
 *  Once the user clicks the simulation button:
 *    - The button becomes a "stop" button.
 *    - The << and >> buttons show.
 *    - The diagram is colored as required.
 */
const showSimulationButton = debounce(() => {
  const showButton = q$(`.simulation-button.create[simulation-id="${activeFiniteAutomata}"]`) as HTMLButtonElement;

  showButton.style.display = "inline";
}, 100);

const generateAutomata = debounce(() => {
  const regex = parse(regexInput.value);
  if (regex == null) return;

  const activeTab = document.querySelector(".tab-button.active")?.getAttribute("tab-id");
  console.log(activeTab);

  const glushkovNfa = NFA.fromGlushkovConstruction(regex);
  const [rename1, svg1] = renderSvgElementForAutomata(glushkovNfa);
  globalGlushkovNfa = glushkovNfa;
  globalGlushkovNfaRenameMap = rename1;

  /// We remove the children forcefully.
  document.getElementById("graphviz-output-glushkov-nfa")!.innerHTML = "";
  document.getElementById("graphviz-output-glushkov-nfa")!.appendChild(svg1);

  const thompsonNfa = NFA.fromThompsonConstruction(regex);
  const [rename2, svg2] = renderSvgElementForAutomata(thompsonNfa);
  globalThompsonNfa = thompsonNfa;
  globalThompsonNfaRenameMap = rename2;
  /// We remove the children forcefully.
  document.getElementById("graphviz-output-thompson-nfa")!.innerHTML = "";
  document.getElementById("graphviz-output-thompson-nfa")!.appendChild(svg2);

  const glushkovDfa = glushkovNfa.toDFA({ includeDeadState: glushkovDfaSwitch.checked });
  const [rename3, svg3] = renderSvgElementForAutomata(glushkovDfa);
  globalGlushkovDfa = glushkovDfa;
  globalGlushkovDfaRenameMap = rename3;

  document.getElementById("graphviz-output-glushkov-dfa")!.innerHTML = "";
  document.getElementById("graphviz-output-glushkov-dfa")!.appendChild(svg3);

  const thompsonDfa = glushkovNfa.toDFA({ includeDeadState: thompsonDfaSwitch.checked });
  const [rename4, svg4] = renderSvgElementForAutomata(thompsonDfa);
  globalGlushkovDfa = thompsonDfa;
  globalGlushkovDfaRenameMap = rename4;

  document.getElementById("graphviz-output-thompson-dfa")!.innerHTML = "";
  document.getElementById("graphviz-output-thompson-dfa")!.appendChild(svg4);

  const minimalDfa = thompsonNfa.toDFA({ includeDeadState: minimalDfaSwitch.checked }).minimized();
  const [rename5, svg5] = renderSvgElementForAutomata(minimalDfa);
  globalMinimalDfa = minimalDfa;
  globalMinimalDfaRenameMap = rename5;

  document.getElementById("graphviz-output-minimal-dfa")!.innerHTML = "";
  document.getElementById("graphviz-output-minimal-dfa")!.appendChild(svg5);
}, 250);

const match = debounce(() => {
  const input = stringInput.value;

  if (input.length <= 0) return;

  const [renameMap, automata] = getActiveAutomata()!;
  if (renameMap == null || automata == null) return;

  if (automata instanceof NFA) {
    const [states, accepts] = automata.acceptsDetailed(input);
    if (accepts) {
      recognizeOutput.textContent = "Recognized.";

      recognizeOutput.classList.add("success");
      recognizeOutput.classList.remove("failure");
    } else {
      const currentStates = [...states].map((s) => renameMap.get(s)).join(", ");

      recognizeOutput.textContent = `String not accepted. Ending states = {${currentStates}}`;
      recognizeOutput.classList.add("failure");
      recognizeOutput.classList.remove("success");
    }
  } else if (automata instanceof DFA) {
    const [state, accepts] = automata.acceptsDetailed(input);
    if (accepts) {
      recognizeOutput.textContent = "Recognized.";

      recognizeOutput.classList.add("success");
      recognizeOutput.classList.remove("failure");
    } else {
      const currentState = renameMap.get(state) || "∅";

      recognizeOutput.textContent = `String not accepted. Last state = ${currentState}`;
      recognizeOutput.classList.add("failure");
      recognizeOutput.classList.remove("success");
    }
  }

  showSimulationButton();
}, 250);

const toggleTrapStateInclusion = debounce((id: "glushkov-dfa" | "thompson-dfa" | "minimal-dfa") => {
  const messageSpan = $(`${id}-switch-indicator`)!;
  const switchElement = $(`${id}-switch`)! as HTMLInputElement;
  const simulateButton = q$(`.simulation-button.create[simulation-id="${id}"]`)!;

  if (switchElement.checked) {
    messageSpan.textContent = "including Trap State";
    simulateButton.removeAttribute("disabled");
    simulateButton.removeAttribute("title");
  } else {
    messageSpan.textContent = "excluding Trap State";
    simulateButton.setAttribute("disabled", "true");
    simulateButton.setAttribute("title", "Include the trap state to allow simulation!");
  }

  generateAutomata();
}, 5);

regexInput.addEventListener("input", generateAutomata);
regexInput.addEventListener("input", match);
stringInput.addEventListener("input", match);
glushkovDfaSwitch.addEventListener("change", _ => toggleTrapStateInclusion("glushkov-dfa"));
thompsonDfaSwitch.addEventListener("change", _ => toggleTrapStateInclusion("thompson-dfa"));
minimalDfaSwitch.addEventListener("change", _ => toggleTrapStateInclusion("minimal-dfa"));

const tabButtons = $$("tab-button") as HTMLCollectionOf<HTMLButtonElement>;
for (const button of tabButtons) {
  button.addEventListener("click", function (this: HTMLButtonElement) {
    const id = this.getAttribute("tab-id") as Id;
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
    activeFiniteAutomata = id;


    match();
  }.bind(button));
}

const simulationButtons = $$("simulation-button") as HTMLCollectionOf<HTMLButtonElement>;
for (const button of simulationButtons) {
  button.addEventListener("click", function (this: HTMLButtonElement) {
    const id = this.getAttribute("simulation-id") as Id;
    if (this.classList.contains("next")) {
      simulation.nextStep(id);
    } else if (this.classList.contains("previous")) {
      simulation.previousStep(id);
    } else {

      if (this.classList.contains("create")) {
        simulation.create(id);
      } else if (this.classList.contains("stop")) {
        simulation.destroy(id);
      }
    }
  }.bind(button));
}
console.log(simulationButtons);