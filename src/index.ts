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

let activeFiniteAutomata: Id = "glushkov-nfa";

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

const getActiveAutomata = (): [Map<State, string>, FiniteAutomata] | null => {
  if (activeFiniteAutomata == null) {
    return null;
  }

  let activeAutomata: FiniteAutomata;
  let activeRenameMap: Map<State, string>;
  switch (activeFiniteAutomata) {
    case "glushkov-nfa":
      activeAutomata = globalGlushkovNfa!;
      activeRenameMap = globalGlushkovRenameMap!;
      break;
    case "thompson-nfa":
      activeAutomata = globalThompsonNfa!;
      activeRenameMap = globalThompsonRenameMap!;
      break;
    case "dfa":
      activeAutomata = globalDfa!;
      activeRenameMap = globalDfaRenameMap!;
      break;
    case "minimal-dfa":
      activeAutomata = globalMinimalDfa!;
      activeRenameMap = globalMinimalDfaRenameMap!;
      break;
  }

  return [activeRenameMap, activeAutomata];
}

type Id = "glushkov-nfa" | "thompson-nfa" | "dfa" | "minimal-dfa";
type NFALocalSim = {
  string: string,
  sequence: (Set<State> | [State, string, State][])[];
  step: number;
  stringOutput: HTMLElement;
  svg: SVGSVGElement;
};
type DFALocalSim = {
  string: string,
  sequence: (State | [State, string, State])[];
  step: number;
  stringOutput: HTMLElement;
  svg: SVGSVGElement;
};
type Simulation = {
  simulations: {
    "glushkov-nfa"?: NFALocalSim,
    "thompson-nfa"?: NFALocalSim,
    "dfa"?: DFALocalSim,
    "minimal-dfa"?: DFALocalSim,
  },
  nextStep(id: Id): void,
  previousStep(id: Id): void,
  create(id: Id): void,
  destroy(id: Id): void,
  draw(id: Id): void,
};
const simulation: Simulation = {
  simulations: {},
  nextStep(this: Simulation, id: Id) {
    const sim = this.simulations[id] as NFALocalSim & DFALocalSim;
    sim.step = Math.min(sim.sequence.length - 1, sim.step + 1);
    this.draw(id);
  },
  previousStep(this: Simulation, id: Id) {
    const sim = this.simulations[id] as NFALocalSim & DFALocalSim;
    sim.step = Math.max(-1, sim.step - 1);
    this.draw(id);
  },
  create(this: Simulation, id: Id) {
    const btn = document.querySelector(`.simulation-button[simulation-id="${id}"]`) as HTMLElement;
    const area = document.querySelector(`.simulation-area[simulation-id="${id}"]`) as HTMLElement;
    const svgSource = document.getElementById(`graphviz-output-${id}`)?.children?.[0];
    if (svgSource == null) return;

    btn.textContent = "Stop Simulation";
    btn.classList.remove("create");
    btn.classList.add("stop");

    document.getElementById("regex-input")?.setAttribute("disabled", "true");
    document.getElementById("string-input")?.setAttribute("disabled", "true");
    for (const link of document.getElementsByClassName("tablinks")) {
      link.setAttribute("disabled", "true");
    }

    const textOutput = area.querySelector(`#live-text`) as HTMLDivElement;
    const svgOutput = area.querySelector(`#live-svg`) as HTMLDivElement;
    if (textOutput == null || svgOutput == null) return;

    const input = stringInput.value;

    let i = 0;
    for (const token of input.split("")) {
      const element = document.createElement("span");
      element.setAttribute("idx", `${i++}`);
      element.textContent = token;

      textOutput.appendChild(element);
    }

    const [renameMap, automata] = getActiveAutomata()!;
    const svg = viz.renderSVGElement(automata.dot({ renames: renameMap }));
    svgOutput.appendChild(svg);

    area.style.display = "block";

    if (id == "glushkov-nfa" || id == "thompson-nfa") {
      this.simulations[id] = {
        string: input,
        sequence: [...(automata as NFA).generateSequence(input)],
        step: -1,
        svg: svg,
        stringOutput: textOutput,
      };
    } else {

      throw new Error("Unimplemented.");
      // this.simulations[id].string = input;
      // this.simulations[id].sequence = (automata as DFA).generateSequence(input);
      // this.simulations[id].step = 0;
    }
  },
  destroy(this: Simulation, id: Id) {
    const btn = document.querySelector(`.simulation-button[simulation-id="${id}"]`) as HTMLElement;
    const area = document.querySelector(`.simulation-area[simulation-id="${id}"]`) as HTMLElement;

    btn.textContent = "Simulate";
    btn.classList.remove("stop");
    btn.classList.add("create");

    document.getElementById("regex-input")?.removeAttribute("disabled");
    document.getElementById("string-input")?.removeAttribute("disabled");
    for (const link of document.getElementsByClassName("tablinks")) {
      link.removeAttribute("disabled");
    }


    const textOutput = area.querySelector(`#live-text`) as HTMLDivElement;
    const svgOutput = area.querySelector(`#live-svg`) as HTMLDivElement;
    if (textOutput == null || svgOutput == null) return;

    textOutput.innerHTML = "";
    svgOutput.innerHTML = "";

    area.style.display = "none";

    delete this.simulations[id];
  },
  draw(this: Simulation, id: Id) {
    const sim = this.simulations[id] as NFALocalSim;

    /// We color the previouses black.
    for (const colored of sim.svg.querySelectorAll(`.previous[stroke="red"]`)) {
      colored.setAttribute("stroke", "black");
    }
    for (const colored of sim.svg.querySelectorAll(`.previous[fill="red"]`)) {
      colored.setAttribute("fill", "black");
    }
    for (const prev of sim.svg.querySelectorAll(".previous")) {
      prev.classList.remove("previous");
    }

    for (let i = 0; i < sim.string.length; ++i) {
      const span = sim.stringOutput.querySelector(`[idx="${i}"]`) as HTMLSpanElement;

      span.style.color = "black";
    }

    const colorParentOf = (target: HTMLTitleElement | null, color?: string) => {
      color ??= "red";

      if (target == null) return;
      const parent = target.parentElement;
      if (parent == null) return;

      for (const element of parent.querySelectorAll(`[stroke="black"]`)) {
        element.setAttribute("stroke", color);
        element.classList.add("previous");
      }
      for (const element of parent.querySelectorAll(`[fill="black"]`)) {
        element.setAttribute("fill", color);
        element.classList.add("previous");
      }
    };

    if (sim.step < 0) return;

    if (sim.step == 0) {
      /// Highlight the start arrow. Then we move to the different start states.
      const arrow = [...sim.svg.querySelectorAll("title")]
        .filter(s => s.textContent == "n__->0")[0];

      colorParentOf(arrow);
    }

    if (sim.step % 2 != 0) {
      /// We are now pointing at (active) states.
      for (let i = 0; i < sim.step / 2 - 1; ++i) {
        (sim.stringOutput.querySelector(`[idx="${i}"]`) as HTMLSpanElement).style.color = "gray";
      }

      const states = [...sim.sequence[sim.step] as Set<State>];
      const stateTitles = [...sim.svg.querySelectorAll("title")]
        .filter(t => states.some(s => s.id.toString() === t.textContent));

      stateTitles.forEach(t => colorParentOf(t));
    } else if (sim.step % 2 == 0) {
      /// We are looking at transitions.

      /// Color the letters.
      const half = sim.step / 2;
      const spans: HTMLSpanElement[] = [];
      for (let i = 0; i < half; ++i) {
        const span = sim.stringOutput.querySelector(`[idx="${i}"]`) as HTMLSpanElement;

        span.style.color = "grey";
        spans.push(span);
      }
      if (spans.length > 0) {
        spans.at(-1)!.style.color = "red";
      }

      /// Draw the different arrows.
      const transitions = sim.sequence[sim.step] as [State, string, State][];
      for (const [from, _, to] of transitions) {
        const allTitles = [...sim.svg.querySelectorAll("title")];
        const fromTitle = allTitles.filter(t => from.id.toString() == t.textContent)[0];
        const arrow = [...sim.svg.querySelectorAll("title")]
          .filter(s => s.textContent == `${from.id}->${to.id}`)[0];

        [fromTitle, arrow].forEach(t => colorParentOf(t));
      }
      console.log(transitions);
    }

    console.log(sim);
  },
};

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

  const svgOutput = viz.renderSVGElement(automata.dot({ renames: renameMap }));

  return [renameMap, svgOutput];
};

/**
 * SIMULATION:
 *  Once the user clicks the simulation button:
 *    - The button becomes a "stop" button.
 *    - The << and >> buttons show.
 *    - The diagram is colored as required.
 *    - The string is colored as follows:
 *    -   Gray -> read
 *    -   Blue -> being read
 *    -   Red -> Failed at character.
 */
const showSimulationButton = debounce(() => {
  const showButton = document.querySelector(`.simulation-button.create[simulation-id="${activeFiniteAutomata}"]`) as HTMLButtonElement;

  showButton.style.display = "inline";
}, 100);

const convert = debounce(() => {
  const regex = parse(regexInput.value);
  if (regex == null) return;

  const activeTab = document.querySelector(".tab-button.active")?.getAttribute("tab-id");
  console.log(activeTab);

  const glushkovNfa = NFA.fromGlushkovConstruction(regex);
  const [rename1, svg1] = renderSvgElementForAutomata(glushkovNfa);
  globalGlushkovNfa = glushkovNfa;
  globalGlushkovRenameMap = rename1;

  /// We remove the children forcefully.
  document.getElementById("graphviz-output-glushkov-nfa")!.innerHTML = "";
  document.getElementById("graphviz-output-glushkov-nfa")!.appendChild(svg1);

  const thompsonNfa = NFA.fromThompsonConstruction(regex);
  const [rename2, svg2] = renderSvgElementForAutomata(thompsonNfa);
  globalThompsonNfa = thompsonNfa;
  globalThompsonRenameMap = rename2;
  /// We remove the children forcefully.
  document.getElementById("graphviz-output-thompson-nfa")!.innerHTML = "";
  document.getElementById("graphviz-output-thompson-nfa")!.appendChild(svg2);

  const dfa = glushkovNfa.toDFA({ includeDeadState: dfaSwitch.checked });
  const [rename3, svg3] = renderSvgElementForAutomata(dfa);
  globalDfa = dfa;
  globalDfaRenameMap = rename3;

  document.getElementById("graphviz-output-dfa")!.innerHTML = "";
  document.getElementById("graphviz-output-dfa")!.appendChild(svg3);

  const minimalDfa = thompsonNfa.toDFA({ includeDeadState: minimalDfaSwitch.checked }).minimized();
  const [rename4, svg4] = renderSvgElementForAutomata(minimalDfa);
  globalMinimalDfa = minimalDfa;
  globalMinimalDfaRenameMap = rename4;

  document.getElementById("graphviz-output-minimal-dfa")!.innerHTML = "";
  document.getElementById("graphviz-output-minimal-dfa")!.appendChild(svg4);
}, 250);

const match = debounce(() => {
  const input = stringInput.value;

  if (activeFiniteAutomata == null) return;
  if (input.length <= 0) return;

  const [renameMap, automata] = getActiveAutomata()!;
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