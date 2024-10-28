import { DFA, NFA, State } from "./automata";
import { stringInput } from "./elements";
import { getActiveAutomata, viz } from "./index";
import { $, $$, q$ } from "./utility";

export type Id = "glushkov-nfa" | "thompson-nfa" | "glushkov-dfa" | "thompson-dfa" | "minimal-dfa";
type NFALocalSim = {
  string: string,
  sequence: (Set<State> | [State | null, string, State | null][])[];
  step: number;
  stringOutput: HTMLElement;
  svg: SVGSVGElement;
  identifier: "NFA",
};
type DFALocalSim = {
  string: string,
  sequence: (State | [State | null, string, State | null])[];
  step: number;
  stringOutput: HTMLElement;
  svg: SVGSVGElement;
  identifier: "DFA",
};
type Simulation = {
  simulations: {
    "glushkov-nfa"?: NFALocalSim,
    "thompson-nfa"?: NFALocalSim,
    "glushkov-dfa"?: DFALocalSim,
    "thompson-dfa"?: DFALocalSim,
    "minimal-dfa"?: DFALocalSim,
  },
  nextStep(id: Id): void,
  previousStep(id: Id): void,
  create(id: Id): void,
  destroy(id: Id): void,
  draw(id: Id): void,
  lockIfNecessary(id: Id): void,
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
    /// Oh wow, this pattern does get tiring. I want monads.
    if (btn == null || area == null) return;

    const svgSource = $(`graphviz-output-${id}`)?.children?.[0];
    if (svgSource == null) return;

    btn.textContent = "Stop Simulation";
    btn.classList.remove("create");
    btn.classList.add("stop");

    $("regex-input")?.setAttribute("disabled", "true");
    $("string-input")?.setAttribute("disabled", "true");
    $(`${id}-switch`)?.setAttribute("disabled", "true");
    for (const link of $$("tablinks")) {
      link.setAttribute("disabled", "true");
    }

    const textOutput = area.querySelector(`#live-text`) as HTMLDivElement | null;
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

    area.style.display = "block";

    if (id == "glushkov-nfa" || id == "thompson-nfa") {
      this.simulations[id] = {
        string: input,
        sequence: [...(automata as NFA).generateSequence(input)],
        step: -1,
        svg: svg,
        stringOutput: textOutput,
        identifier: "NFA",
      };
      this.lockIfNecessary(id);
    } else {
      this.simulations[id] = {
        string: input,
        sequence: [...(automata as DFA).generateSequence(input)],
        step: -1,
        svg: svg,
        stringOutput: textOutput,
        identifier: "DFA",
      };
      this.lockIfNecessary(id);
    }
  },
  destroy(this: Simulation, id: Id): void {
    const btn = q$(`.simulation-button[simulation-id="${id}"]`) as HTMLElement;
    const area = q$(`.simulation-area[simulation-id="${id}"]`) as HTMLElement;

    btn.textContent = "Simulate";
    btn.classList.remove("stop");
    btn.classList.add("create");

    $("regex-input")?.removeAttribute("disabled");
    $("string-input")?.removeAttribute("disabled");
    $(`${id}-switch`)?.removeAttribute("disabled");
    for (const link of $$("tablinks")) {
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

    if (sim.step < 0) return;

    for (let i = 0; i < sim.string.length; ++i) {
      const span = sim.stringOutput.querySelector(`[idx="${i}"]`) as HTMLSpanElement;

      span.style.color = "black";
    }

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

    if (sim.identifier == "NFA") {
      const sim = this.simulations[id] as NFALocalSim;

      if (sim.step == 0) {
        /// Highlight the start arrow. Then we move to the different start states.
        const arrow = [...sim.svg.querySelectorAll("title")]
          .filter(s => s.textContent!.includes(`n__->`))[0];
        colorParentOf(arrow);
      }

      if (sim.step % 2 != 0) {
        /// We are now pointing at (active) states.

        /// Color the letters.
        for (let i = 0; i < sim.step / 2 - 1; ++i) {
          (sim.stringOutput.querySelector(`[idx="${i}"]`) as HTMLSpanElement).style.color = "gray";
        }

        /// Color the states.
        const states = [...sim.sequence[sim.step] as Set<State>];
        const stateTitles = [...sim.svg.querySelectorAll("title")]
          .filter(t => states.some(s => s.id.toString() === t.textContent));

        stateTitles.forEach(t => colorParentOf(t, "lime"));
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
        const transitions = sim.sequence[sim.step] as [State | null, string, State | null][];
        for (const [from, _, to] of transitions) {
          if (from == null || to == null) continue;

          const allTitles = [...sim.svg.querySelectorAll("title")];
          const fromTitle = allTitles.filter(t => from.id.toString() == t.textContent)[0];
          const arrow = [...sim.svg.querySelectorAll("title")]
            .filter(s => s.textContent == `${from.id}->${to.id}`)[0];

          [fromTitle, arrow].forEach(t => colorParentOf(t));
        }

        if (sim.step - 1 > 0) {
          const states = [...sim.sequence[sim.step - 1] as Set<State>];
          const stateTitles = [...sim.svg.querySelectorAll("title")]
            .filter(t => states.some(s => s.id.toString() === t.textContent));

          stateTitles.forEach(t => colorParentOf(t, "lime"));
        }
      }
      console.log(sim);
    } else if (sim.identifier == "DFA") {
      const sim = this.simulations[id] as DFALocalSim;

      if (sim.step == 0) {
        /// Highlight the start arrow. Then we move to the different start states.
        const arrow = [...sim.svg.querySelectorAll("title")]
          .filter(s => s.textContent!.includes(`n__->`))[0];

        colorParentOf(arrow);
      }

      if (sim.step % 2 != 0) {
        /// We are now pointing at (active) states.

        /// Color the letters.
        for (let i = 0; i < sim.step / 2 - 1; ++i) {
          (sim.stringOutput.querySelector(`[idx="${i}"]`) as HTMLSpanElement).style.color = "gray";
        }

        /// Color the states.
        const state = sim.sequence[sim.step] as State;
        const stateTile = [...sim.svg.querySelectorAll("title")]
          .filter(t => state.id.toString() === t.textContent)[0];
        colorParentOf(stateTile, "lime");
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
        const [from, _, to] = sim.sequence[sim.step] as [State | null, string, State | null];
        if (from == null || to == null) return;

        const allTitles = [...sim.svg.querySelectorAll("title")];
        const fromTitle = allTitles.filter(t => from.id.toString() == t.textContent)[0];
        const arrow = [...sim.svg.querySelectorAll("title")]
          .filter(s => s.textContent == `${from.id}->${to.id}`)[0];
        [fromTitle, arrow].forEach(t => colorParentOf(t));

        if (sim.step - 1 > 0) {
          const state = sim.sequence[sim.step - 1] as State;
          const stateTile = [...sim.svg.querySelectorAll("title")]
            .filter(t => state.id.toString() === t.textContent)[0];
          colorParentOf(stateTile, "lime");
        }
      }
      console.log(sim);
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
  }
};