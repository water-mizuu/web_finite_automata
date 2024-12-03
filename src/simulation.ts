import { DFA, NFA, State } from "./automata";
import { stringInput } from "./elements";
import { getActiveAutomata, viz } from "./index";
import { $, $$, q$ } from "./utility";

export type Id = "glushkov-nfa" | "glushkov-dfa" | "minimal-dfa";

export type NFAStep =
  | {
    resultStates: Set<State>;
    transitions: [State, State][];
    identifier: "initial";
  }
  | {
    scannedIndex: number;
    states: Set<State>;
    identifier: "state";
  }
  | {
    scannedIndex: number;
    resultStates: Set<State>;
    transitions: [State, State][];
    identifier: "transition";
  }
  | {
    finalStates: Set<State>;
    status: "recognized" | "not-recognized";
    identifier: "complete";
  }
  | {
    finalStates: null;
    status: "immature-abort";
    identifier: "complete";
  }
  | { scannedIndex: number; identifier: "error" }
  ;
export type DFAStep =
  | { startState: State; identifier: "initial" }
  | { scannedIndex: number; state: State; identifier: "state" }
  | {
    scannedIndex: number;
    resultState: State;
    transition: [State, State];
    identifier: "transition";
  }
  | {
    scannedIndex: number;
    resultState: null;
    transition: null;
    identifier: "transition";
  }
  | { finalState: State; status: "recognized" | "not-recognized"; identifier: "complete" }
  | { finalState: null; status: "immature-abort"; identifier: "complete" }
  | { scannedIndex: number; identifier: "error" }
  ;
type NFALocalSim = {
  string: string;
  sequence: NFAStep[];
  step: number;
  renameMap: Map<State, String>;
  svg: SVGSVGElement;
  identifier: "NFA";
};
type DFALocalSim = {
  string: string;
  sequence: DFAStep[];
  step: number;
  renameMap: Map<State, String>;
  svg: SVGSVGElement;
  identifier: "DFA";
};
type Simulation = {
  simulations: {
    "glushkov-nfa"?: NFALocalSim;
    "glushkov-dfa"?: DFALocalSim;
    "minimal-dfa"?: DFALocalSim;
  };
  nextStep(id: Id): void;
  previousStep(id: Id): void;
  create(id: Id): void;
  destroy(id: Id): void;
  draw(id: Id): void;
  lockIfNecessary(id: Id): void;
};

const spanOfIndex = (id: Id, index: number): HTMLSpanElement =>
  document.querySelector(
    `.simulation-area[simulation-id=${id}] .live-text [idx="${index}"]`
  ) as HTMLSpanElement;

const setActionMessage = (id: Id, str: string) => {
  const query = `.simulation-area[simulation-id=${id}] .action-text`;
  const element = q$(query);
  if (element == null) return;

  element.textContent = str;
};

const colorParentOf = (target: HTMLTitleElement | null, color?: string) => {
  color ??= "red";

  if (target == null) return;
  const parent = target.parentElement;
  if (parent == null) return;

  for (const element of parent.querySelectorAll(`[stroke]`)) {
    if (element.getAttribute("stroke") == "none") continue;

    element.setAttribute("stroke", color);
    element.classList.add("modified-stroke");
  }
  for (const element of parent.querySelectorAll(`[fill]`)) {
    if (element.getAttribute("fill") == "none") continue;

    element.setAttribute("fill", color);
    element.classList.add("modified-fill");
  }
};

export const simulation: Simulation = {
  simulations: {},
  nextStep(this: Simulation, id: Id) {
    const sim = this.simulations[id]!;
    sim.step = Math.min(sim.sequence.length - 1, sim.step + 1);
    this.draw(id);
    this.lockIfNecessary(id);
  },
  previousStep(this: Simulation, id: Id) {
    const sim = this.simulations[id]!;
    sim.step = Math.max(-1, sim.step - 1);
    this.draw(id);
    this.lockIfNecessary(id);
  },
  create(this: Simulation, id: Id): void {
    const btn = q$(`.simulation-button[simulation-id="${id}"]`) as HTMLElement | null;
    const area = q$(`.simulation-area[simulation-id="${id}"]`) as HTMLElement | null;
    if (btn == null || area == null) return;

    const svgSource = $(`graphviz-output-${id}`)?.children?.[0];
    if (svgSource == null) return;

    btn.classList.remove("create");
    btn.classList.add("stop");

    $("regex-input")?.setAttribute("disabled", "true");
    $("string-input")?.setAttribute("disabled", "true");
    $(`${id}-switch`)?.setAttribute("disabled", "true");
    for (const link of $$("tablinks")) {
      link.setAttribute("disabled", "true");
    }

    const textOutput = area.querySelector(`.live-text`) as HTMLDivElement | null;
    const svgOutput = area.querySelector(`#live-svg`) as HTMLDivElement | null;
    if (textOutput == null || svgOutput == null) return;

    const input = stringInput.value;

    let i = 0;
    for (const token of input.split("")) {
      const element = document.createElement("span");
      element.setAttribute("idx", `${i++}`);
      element.textContent = token;

      textOutput.appendChild(element);
    }

    const [renameMap, automata] = getActiveAutomata();
    if (renameMap == null || automata == null) return;

    const svg = viz.renderSVGElement(automata.dot({ renames: renameMap }));
    svgOutput.appendChild(svg);

    area.classList.add("visible");
    // area.style.display = "block";

    if (id == "glushkov-nfa") {
      this.simulations[id] = {
        string: input,
        sequence: [...(automata as NFA).generateSimulationSteps(input)],
        step: -1,
        svg: svg,
        renameMap: renameMap,
        identifier: "NFA",
      };
      this.lockIfNecessary(id);
    } else {
      this.simulations[id] = {
        string: input,
        sequence: [...(automata as DFA).generateSimulationSteps(input)],
        step: -1,
        svg: svg,
        renameMap: renameMap,
        identifier: "DFA",
      };
      this.lockIfNecessary(id);
    }
  },
  destroy(this: Simulation, id: Id): void {
    const btn = q$(`.simulation-button[simulation-id="${id}"]`) as HTMLElement | null;
    const area = q$(`.simulation-area[simulation-id="${id}"]`) as HTMLElement | null;
    if (btn == null || area == null) return;

    btn.classList.remove("stop");
    btn.classList.add("create");

    $("regex-input")?.removeAttribute("disabled");
    $("string-input")?.removeAttribute("disabled");
    $(`${id}-switch`)?.removeAttribute("disabled");
    for (const link of $$("tablinks")) {
      link.removeAttribute("disabled");
    }

    const svgOutput = area.querySelector(`#live-svg`) as HTMLDivElement;
    const textOutput = area.querySelector(`.live-text`) as HTMLSpanElement;
    const actionOutput = area.querySelector(`.action-text`) as HTMLSpanElement;
    if (textOutput == null || svgOutput == null || actionOutput == null) return;

    textOutput.innerHTML = "";
    svgOutput.innerHTML = "";
    actionOutput.innerHTML = "";

    area.classList.remove("visible");

    delete this.simulations[id];
  },
  draw(this: Simulation, id: Id): void {
    const sim = this.simulations[id];
    if (sim == null) return;

    /**
     * If the previous draw cycle marked the elements as modified,
     *   we color the marked properties back. (We assume they were colored black.)
     */
    for (const colored of sim.svg.querySelectorAll(`.modified-stroke`)) {
      colored.setAttribute("stroke", "black");
      colored.classList.remove("modified-stroke");
    }
    for (const colored of sim.svg.querySelectorAll(`.modified-fill`)) {
      colored.setAttribute("fill", "black");
      colored.classList.remove("modified-fill");
    }
    setActionMessage(id, "");

    if (sim.step < 0) return;

    for (let i = 0; i < sim.string.length; ++i) {
      spanOfIndex(id, i).style.color = "black";
    }

    if (sim.identifier == "NFA") {
      const sim = this.simulations[id] as NFALocalSim;
      const chosen = sim.sequence[sim.step];

      const drawPreviousStates = () => {
        if (sim.step <= 1) return;

        let lastStatesIndex = sim.step - 1;
        while (lastStatesIndex >= 0) {
          if (sim.sequence[lastStatesIndex].identifier === "state") {
            break;
          }
          lastStatesIndex--;
        }

        const lastStates = sim.sequence[lastStatesIndex];
        if (lastStates.identifier === "state") {
          const states = [...lastStates.states];
          const stateTitles = [...sim.svg.querySelectorAll("title")].filter((t) =>
            states.some((s) => s.id.toString() === t.textContent)
          );

          stateTitles.forEach((t) => colorParentOf(t, "lime"));
        }
      };

      switch (chosen.identifier) {
        case "initial": {
          /// Set the status mesage.
          setActionMessage(id, `Resolving initial states`);

          const arrow = [...sim.svg.querySelectorAll("title")].filter((s) =>
            s.textContent!.includes(`n__->`)
          )[0];

          if (arrow !== undefined) {
            colorParentOf(arrow);
          }

          /// No break.
        }
        case "transition": {
          /// Set the status mesage.
          if (chosen.identifier == "transition") {
            const character = sim.string[chosen.scannedIndex];

            setActionMessage(
              id,
              `At index ${chosen.scannedIndex}, reading character '${character}'`
            );

            /// Color the letters.

            for (let i = 0; i < chosen.scannedIndex; ++i) {
              spanOfIndex(id, i).style.color = "grey";
            }
            spanOfIndex(id, chosen.scannedIndex).style.color = "red";
          }

          /// Draw the different arrows.
          for (const [from, to] of chosen.transitions) {
            if (from == null || to == null) continue;

            const allTitles = [...sim.svg.querySelectorAll("title")];
            const fromTitle = allTitles.filter((t) => from.id.toString() == t.textContent)[0];
            const arrow = [...sim.svg.querySelectorAll("title")].filter(
              (s) => s.textContent == `${from.id}->${to.id}`
            )[0];

            colorParentOf(arrow, "red");
            colorParentOf(fromTitle, "red");
          }

          /// Draw the previous states as green.
          drawPreviousStates();
          break;
        }
        case "state": {
          const displayStates = [...chosen.states].map((s) => sim.renameMap.get(s)).join(", ");
          const latter =
            chosen.states.size == 1 //
              ? ` is ${displayStates}`
              : `s are { ${displayStates} }`;
          setActionMessage(id, `The state${latter}`);

          /// Color the letters.
          for (let i = 0; i <= chosen.scannedIndex; ++i) {
            spanOfIndex(id, i).style.color = "grey";
          }

          /// Color the states.
          const states = [...chosen.states];
          const stateTitles = [...sim.svg.querySelectorAll("title")].filter((t) =>
            states.some((s) => s.id.toString() === t.textContent)
          );

          stateTitles.forEach((t) => colorParentOf(t, "lime"));
          break;
        }
        case "complete": {
          if (chosen.status === "immature-abort") {
            for (let i = 0; i < sim.string.length; ++i) {
              spanOfIndex(id, i).style.color = "red";
            }

            const message = `The tracked states did not resolve a state, so the string is not accepted.`;

            setActionMessage(id, message);
          } else {
            const isRecognized = chosen.status == "recognized";

            for (let i = 0; i < sim.string.length; ++i) {
              spanOfIndex(id, i).style.color = isRecognized ? "green" : "red";
            }
            const states = [...chosen.finalStates].map((s) => sim.renameMap.get(s)).join(", ");
            const latter = chosen.finalStates.size == 1 ? ` is ${states}` : `s are { ${states} }`;

            const verdict = isRecognized ? "recognized" : "not recognized";
            setActionMessage(id, `The resulting state${latter}, so it is ${verdict}.`);
            drawPreviousStates();
          }
          break;
        }
        case "error": {
          const character = sim.string[chosen.scannedIndex];
          setActionMessage(
            id,
            `At index ${chosen.scannedIndex}, the character '${character}' is not a part of the alphabet, therefore the string is rejected.`
          );

          for (let i = 0; i < sim.string.length; ++i) {
            spanOfIndex(id, i).style.color = "red";
          }
          break;
        }
      }
    } else if (sim.identifier == "DFA") {
      const sim = this.simulations[id] as DFALocalSim;
      const chosen = sim.sequence[sim.step];

      const drawPreviousState = () => {
        if (sim.step <= 1) return;

        let lastStatesIndex = sim.step - 1;
        while (lastStatesIndex >= 0) {
          if (sim.sequence[lastStatesIndex].identifier === "state") {
            break;
          }
          lastStatesIndex--;
        }

        const lastStates = sim.sequence[lastStatesIndex];
        if (lastStates.identifier === "state") {
          const lastState = lastStates.state;
          const stateTitles = [...sim.svg.querySelectorAll("title")].filter(
            (t) => lastState.id.toString() === t.textContent
          );

          stateTitles.forEach((t) => colorParentOf(t, "lime"));
        }
      };

      switch (chosen.identifier) {
        case "initial": {
          /// Set the status mesage.
          setActionMessage(id, `Resolving initial states`);

          const arrow = [...sim.svg.querySelectorAll("title")].filter((s) =>
            s.textContent!.includes(`n__->`)
          )[0];

          if (arrow !== undefined) {
            colorParentOf(arrow);
          }

          break;
        }
        case "transition": {
          /// Set the status mesage.
          const character = sim.string[chosen.scannedIndex];

          setActionMessage(id, `At index ${chosen.scannedIndex}, reading character '${character}'`);

          /// Color the letters.

          for (let i = 0; i < chosen.scannedIndex; ++i) {
            spanOfIndex(id, i).style.color = "grey";
          }
          spanOfIndex(id, chosen.scannedIndex).style.color = "red";

          /// Draw the different arrows.
          if (chosen.transition != null) {
            const [from, to] = chosen.transition;
            const allTitles = [...sim.svg.querySelectorAll("title")];
            const fromTitle = allTitles.filter((t) => from.id.toString() == t.textContent)[0];
            const arrow = [...sim.svg.querySelectorAll("title")].filter(
              (s) => s.textContent == `${from.id}->${to.id}`
            )[0];

            colorParentOf(arrow, "red");
            colorParentOf(fromTitle, "red");

            /// Draw the previous states as green.
          }
          drawPreviousState();
          break;
        }
        case "state": {
          const displayState = sim.renameMap.get(chosen.state) ?? "the trap state";
          setActionMessage(id, `The state is ${displayState}`);

          /// Color the letters.
          for (let i = 0; i <= chosen.scannedIndex; ++i) {
            spanOfIndex(id, i).style.color = "grey";
          }

          /// Color the states.
          const state = chosen.state;
          const stateTitles = [...sim.svg.querySelectorAll("title")].filter(
            (t) => t.textContent == state.id.toString()
          );

          stateTitles.forEach((t) => colorParentOf(t, "lime"));
          break;
        }
        case "complete": {
          if (chosen.status === "immature-abort") {
            for (let i = 0; i < sim.string.length; ++i) {
              spanOfIndex(id, i).style.color = "red";
            }

            const message = `The tracked state did not resolve a state, meaning that it went to a trap state, so the string is not recognized.`;

            setActionMessage(id, message);
          } else {
            const isRecognized = chosen.status == "recognized";

            for (let i = 0; i < sim.string.length; ++i) {
              spanOfIndex(id, i).style.color = isRecognized ? "green" : "red";
            }

            const state = sim.renameMap.get(chosen.finalState) ?? "the trap state";
            const verdict = isRecognized ? "recognized" : "not recognized";
            setActionMessage(id, `The resulting state is ${state}, so it is ${verdict}.`);
            drawPreviousState();
          }
          break;
        }
        case "error": {
          const character = sim.string[chosen.scannedIndex];
          setActionMessage(
            id,
            `At index ${chosen.scannedIndex}, the character '${character}' is not a part of the alphabet, therefore the string is rejected.`
          );

          for (let i = 0; i < sim.string.length; ++i) {
            spanOfIndex(id, i).style.color = "red";
          }
          break;
        }
      }
    }
  },

  /**
   *
   * @param this The [Simulation] singleton object.
   * @param id The [id] used in identifying which area is to be simulated.
   */
  lockIfNecessary(this: Simulation, id: Id): void {
    const sim = this.simulations[id];
    if (sim == null) {
      console.warn(`The simulation for `, { id }, `returned null.`);
      return;
    }

    const previous = q$(`.simulation-button.previous[simulation-id="${id}"]`) as HTMLButtonElement;
    const next = q$(`.simulation-button.next[simulation-id="${id}"]`) as HTMLButtonElement;
    if (previous == null || next == null) {
      console.warn(`The buttons`, { previous, next }, `returned null.`);
      return;
    }

    previous.removeAttribute("disabled");
    next.removeAttribute("disabled");

    if (sim.step - 1 < -1) {
      previous.setAttribute("disabled", "true");
    }
    if (sim.step + 1 >= sim.sequence.length) {
      next.setAttribute("disabled", "true");
    }
  },
};
