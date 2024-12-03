import { instance } from "@viz-js/viz";
import "../styles.css";
import { DFA, FiniteAutomata, NFA, State } from "./automata";
import { debounce } from "./debounce";
import { definition } from "./definition";
import {
  glushkovDfaSwitch,
  minimalDfaSwitch,
  recognizeOutput,
  regexInput,
  stringInput
} from "./elements";
import { parse } from "./parser";
import { Id, simulation } from "./simulation";
import { $, $$, q$$ } from "./utility";

/**
 * Setup the UI necessary scripts.
 */

let activeFiniteAutomata: Id | null = "glushkov-nfa";

let globalGlushkovNfa: NFA | undefined;
let globalGlushkovNfaRenameMap: Map<State, string> | undefined;
let globalGlushkovDfa: DFA | undefined;
let globalGlushkovDfaRenameMap: Map<State, string> | undefined;
let globalMinimalDfa: DFA | undefined;
let globalMinimalDfaRenameMap: Map<State, string> | undefined;

/**
 * Setup the automata.
 */

export const viz = await instance();

export const getAutomataForId = (
  id: Id | null
): [Map<State, string>, FiniteAutomata] | [null, null] => {
  if (id == null) {
    return [null, null];
  }

  let activeAutomata: FiniteAutomata;
  let activeRenameMap: Map<State, string>;
  switch (id) {
    case "glushkov-nfa":
      activeAutomata = globalGlushkovNfa!;
      activeRenameMap = globalGlushkovNfaRenameMap!;
      break;

    case "glushkov-dfa":
      activeAutomata = globalGlushkovDfa!;
      activeRenameMap = globalGlushkovDfaRenameMap!;
      break;

    case "minimal-dfa":
      activeAutomata = globalMinimalDfa!;
      activeRenameMap = globalMinimalDfaRenameMap!;
      break;
  }

  return [activeRenameMap, activeAutomata];
};

export const getActiveAutomata = () => getAutomataForId(activeFiniteAutomata);

/// Returns the rename map (State -> string) and SVG rendering.
///   This is quite slow, as it requires two passes.
const renderSvgElementForAutomata = (
  automata: FiniteAutomata
): [Map<State, string>, SVGSVGElement] => {
  const svgKey = viz.renderSVGElement(automata.dot({ blankStates: false }));

  const idMap = new Map<number, State>();
  const labelMap = new Map<number, Element>();
  const queue = [];
  const texts = [...svgKey.querySelectorAll(".node text")];
  const renameMap = new Map<State, string>();
  for (const state of automata.states) {
    if (state.isTrapState) continue;

    const svgLabel = texts.filter((s) => state.label == s.textContent)[0];
    const query = svgLabel?.previousElementSibling?.getAttribute("cx");
    if (query == null) continue;

    const xPosition = parseInt(query);

    queue.push([state.id, xPosition]);
    labelMap.set(state.id, svgLabel);
    idMap.set(state.id, state);
  }

  const totalCount = Math.ceil(Math.log10(queue.length + 1));
  queue.sort(([, a], [, b]) => b - a);
  while (queue.length > 0) {
    const label = `q${`${renameMap.size + 1}`.padStart(totalCount, '0')}`;
    const [stateId] = queue.pop()!;
    queue.sort(([, a], [, b]) => b - a);

    renameMap.set(idMap.get(stateId)!, label);
  }

  const trapState = [...automata.states].filter(s => s.isTrapState)[0];
  if (trapState != null) {
    renameMap.set(trapState, "∅");
  }

  const svgOutput = viz.renderSVGElement(automata.dot({ renames: renameMap }));

  return [renameMap, svgOutput];
};

const generateAutomata = debounce(() => {
  const regex = parse(regexInput.value);
  if (regex == null) return;

  const glushkovNfa = NFA.fromGlushkovConstruction(regex);
  const [rename1, svg1] = renderSvgElementForAutomata(glushkovNfa);
  globalGlushkovNfa = glushkovNfa;
  globalGlushkovNfaRenameMap = rename1;

  /// We remove the children forcefully.
  document.getElementById("graphviz-output-glushkov-nfa")!.innerHTML = "";
  document.getElementById("graphviz-output-glushkov-nfa")!.appendChild(svg1);

  const glushkovDfa = glushkovNfa.toDFA({ includeDeadState: glushkovDfaSwitch.checked });
  const [rename3, svg3] = renderSvgElementForAutomata(glushkovDfa);
  globalGlushkovDfa = glushkovDfa;
  globalGlushkovDfaRenameMap = rename3;

  document.getElementById("graphviz-output-glushkov-dfa")!.innerHTML = "";
  document.getElementById("graphviz-output-glushkov-dfa")!.appendChild(svg3);

  const minimalDfa = glushkovNfa.toDFA({ includeDeadState: minimalDfaSwitch.checked }).minimized();
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
}, 250);

const toggleTrapStateInclusion = debounce((id: "glushkov-dfa" | "minimal-dfa") => {
  const messageSpan = $(`${id}-switch-indicator`)!;
  const switchElement = $(`${id}-switch`)! as HTMLInputElement;

  if (switchElement.checked) {
    messageSpan.textContent = "including Trap State";
  } else {
    messageSpan.textContent = "excluding Trap State";
  }

  generateAutomata();
}, 5);

regexInput.addEventListener("input", generateAutomata);
regexInput.addEventListener("input", match);
stringInput.addEventListener("input", match);
glushkovDfaSwitch.addEventListener("change", (_) => toggleTrapStateInclusion("glushkov-dfa"));
minimalDfaSwitch.addEventListener("change", (_) => toggleTrapStateInclusion("minimal-dfa"));

const isId = (str: string): str is Id => {
  return (
    str == "glushkov-nfa" ||
    str == "glushkov-dfa" ||
    str == "minimal-dfa"
  );
};

const onInactive = (button: HTMLButtonElement, tabId: string, tabGroupId: string) => {
  /// SPECIAL CASES.
  if (tabGroupId === "automata-types") {
    activeFiniteAutomata = null;
  } else if (isId(tabGroupId)) {
    const id = tabGroupId as Id;

    if (tabId === "simulation") {
      simulation.destroy(id);
    } else if (tabId == "nfa-definition") {
      definition.destroy(id);
    }
  }
};
const onActive = (button: HTMLButtonElement, tabId: string, tabGroupId: string) => {
  /// SPECIAL CASE:
  if (tabGroupId === "automata-types") {
    activeFiniteAutomata = tabId as Id;
  } else if (isId(tabGroupId)) {
    const id = tabGroupId as Id;

    if (tabId === "simulation") {
      simulation.create(id);
      button.removeAttribute("disabled");
    } else if (tabId == "nfa-definition") {
      definition.create(id);
      button.removeAttribute("disabled");
    }
  }
};

for (const btn of $$("tab-button")) {
  const button = btn as HTMLButtonElement;
  button.addEventListener(
    "click",
    function (this: HTMLButtonElement) {
      const id = this.getAttribute("tab-id");
      const tabGroupId = this.getAttribute("tab-group-id");
      if (id == null || tabGroupId == null) {
        throw new Error(`One of these two are null: ${{ id, tabGroupId }}`);
      }

      const tabButtons = q$$(
        `.tab-button[tab-group-id="${tabGroupId}"]`
      ) as NodeListOf<HTMLButtonElement>;
      const tabContents = q$$(
        `.tab-content[tab-group-id="${tabGroupId}"]`
      ) as NodeListOf<HTMLDivElement>;

      const isActive = this.classList.contains("active");
      for (const button of tabButtons) {
        button.classList.remove("active");
      }
      for (const tab of tabContents) {
        const containsActive = tab.classList.contains("active");
        tab.classList.remove("active");

        if (containsActive) {
          const tabId = tab.getAttribute("tab-id")!;

          onInactive(this, tabId, tabGroupId);
        }
      }

      if (!isActive) {
        const target = [...tabContents].filter((e) => e.getAttribute("tab-id") == id);
        if (target.length <= 0) return;
        onActive(this, id, tabGroupId);

        target[0].classList.add("active");
        this.classList.add("active");
      } else {
        onInactive(this, id, tabGroupId);
      }

      match();
    }.bind(button)
  );
}

const simulationButtons = $$("simulation-button") as HTMLCollectionOf<HTMLButtonElement>;
for (const button of simulationButtons) {
  button.addEventListener(
    "click",
    function (this: HTMLButtonElement) {
      const id = this.getAttribute("simulation-id") as Id;
      if (this.classList.contains("next")) {
        simulation.nextStep(id);
      } else if (this.classList.contains("previous")) {
        simulation.previousStep(id);
      }
    }.bind(button)
  );
}
