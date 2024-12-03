import { getAutomataForId } from ".";
import { DFA, FiniteAutomata, NFA, State } from "./automata";
import { Id } from "./simulation";
import { $, $$, q$ } from "./utility";

type StatesOf = (renameMap: Map<State, string>, automata: FiniteAutomata) => State[];
const statesOf: StatesOf = (renameMap, automata) => {
  const states = [...automata.states];
  states.sort((a, b) => renameMap.get(a)!.localeCompare(renameMap.get(b)!));

  return states;
};

type LettersOf = (automata: FiniteAutomata) => string[];
const alphabetOf: LettersOf = (automata) => {
  const output: string[] = [...automata.alphabet].map(s => s || "ε");
  output.sort();

  return output;
};

type GenerateTable = (
  parent: Element,
  renameMap: Map<State, string>,
  automata: FiniteAutomata
) => void;
const generateTable: GenerateTable = (parent, renameMap, automata) => {
  const holder = parent.querySelector(".transitions");
  const table = document.createElement("table");

  /// The first row must be for the alphabet.

  const firstRow = document.createElement("tr");
  firstRow.appendChild(document.createElement("td"));

  const letters = alphabetOf(automata);
  for (const letter of letters) {
    const element = document.createElement("th");

    element.textContent = letter || "ε";
    firstRow.appendChild(element);
  }

  const rows = [firstRow];
  const states = statesOf(renameMap, automata);

  if (automata instanceof NFA) {
    for (const state of states) {
      if (state.isTrapState) continue;

      const row = document.createElement("tr");
      const stateElement = document.createElement("th");
      stateElement.textContent = renameMap.get(state)!;
      row.appendChild(stateElement);

      for (const letter of letters) {
        const element = document.createElement("td");
        const nexts = automata._transitions.get(state).get(letter == "ε" ? "" : letter);

        if (nexts != null) {
          element.textContent = [...nexts].map((s) => renameMap.get(s)!).join(", ");
        }

        row.appendChild(element);
      }

      rows.push(row);
    }
  } else if (automata instanceof DFA) {
    for (const state of states) {
      if (state.isTrapState) continue;

      const row = document.createElement("tr");
      const stateElement = document.createElement("th");
      stateElement.textContent = renameMap.get(state)!;
      row.appendChild(stateElement);

      for (const letter of letters) {
        const element = document.createElement("td");
        const next = automata._transitions.get(state).get(letter);

        if (next != null) {
          element.textContent = renameMap.get(next)!;
        } else {
          element.textContent = "∅";
        }

        row.appendChild(element);
      }

      rows.push(row);
    }
  }
  for (const row of rows) {
    table.appendChild(row);
  }
  holder?.appendChild(table);
};

const generateRenames = (id: Id, renameMap: Map<State, string>, automata: FiniteAutomata) => {
  const holder = q$(`.tab-content[tab-group-id="${id}"] .renames`)!;
  holder.textContent = "";

  const table = document.createElement("table");

  const header = document.createElement("tr");
  const left = document.createElement("th");
  const right = document.createElement("th");

  header.appendChild(left);
  header.appendChild(right);
  if (id == "glushkov-nfa") {
    left.textContent = "Glushkov NFA State";
    right.textContent = "Alias";
  } else if (id == "glushkov-dfa") {
    left.textContent = "Glushkov DFA State";
    right.textContent = "Alias";
  } else if (id == "minimal-dfa") {
    left.textContent = "Glushkov DFA State";
    right.textContent = "Alias";
  }
  table.appendChild(header);

  for (const [state, name] of renameMap) {
    const row = document.createElement("tr");
    const left = document.createElement("td");
    left.textContent = state.label;
    row.appendChild(left);

    const right = document.createElement("td");
    right.textContent = name;
    row.appendChild(right);

    table.appendChild(row);
  }

  holder.appendChild(table);
}

export const definition = {
  create(id: Id) {
    const [renameMap, automata] = getAutomataForId(id);
    if (renameMap == null || automata == null) return;

    const parent = q$(`.tab-content[tab-group-id="${id}"]`);
    if (parent == null) return;

    $("regex-input")?.setAttribute("disabled", "true");
    $("string-input")?.setAttribute("disabled", "true");
    $(`${id}-switch`)?.setAttribute("disabled", "true");
    for (const link of $$("tablinks")) {
      link.setAttribute("disabled", "true");
    }

    // Q Σ δ q[0] F
    const statesElement = parent.querySelector(".states")!;
    statesElement.textContent = statesOf(renameMap, automata)
      .map((s) => renameMap.get(s))
      .join(", ");

    const alphabetElement = parent.querySelector(".alphabet")!;
    alphabetElement.textContent = alphabetOf(automata).join(", ");

    generateTable(parent, renameMap, automata);

    const startElement = parent.querySelector(".initial-state")!;
    const start = automata.start;
    startElement.textContent = renameMap.get(start)!;

    const acceptingElement = parent.querySelector(".final-states")!;
    const accepting = automata.accepting;
    acceptingElement.textContent = [...accepting].map((s) => renameMap.get(s)).join(", ");

    generateRenames(id, renameMap, automata);
  },
  destroy(id: Id) {
    const [renameMap, automata] = getAutomataForId(id);
    if (renameMap == null || automata == null) return;

    const parent = q$(`.tab-content[tab-group-id="${id}"]`);
    if (parent == null) return;

    $("regex-input")?.removeAttribute("disabled");
    $("string-input")?.removeAttribute("disabled");
    $(`${id}-switch`)?.removeAttribute("disabled");
    for (const link of $$("tablinks")) {
      link.removeAttribute("disabled");
    }

    const statesElement = parent.querySelector(".states")!;
    statesElement.textContent = "";

    const alphabetElement = parent.querySelector(".alphabet")!;
    alphabetElement.textContent = "";

    const holder = parent.querySelector(".transitions")!;
    holder.textContent = "";

    const startElement = parent.querySelector(".initial-state")!;
    startElement.textContent = "";

    const acceptingElement = parent.querySelector(".final-states")!;
    acceptingElement.textContent = "";
  },
} as const;
