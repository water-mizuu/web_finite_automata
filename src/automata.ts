import { DefaultMap } from "./default_map";
import {
  epsilon,
  Letter,
  RegularExpression
} from "./regular_expression";
import { DFAStep, NFAStep } from "./simulation";

export class State {
  constructor(
    public id: number,
    public label: string,
  ) { }

  get isTrapState(): boolean {
    return this.label == "" || this.label == "{  }";
  }
}

export abstract class FiniteAutomata {
  abstract accepts(str: string): boolean;

  /**
   * The set of states in this finite automata.
   * Formally Q.
   */
  abstract get states(): Set<State>;

  /**
   * The set of symbols that are accepted in this finite automata.
   * Formally Σ.
   */
  abstract get alphabet(): Set<string>;

  /**
   * The transition function utilized by this automata.
   * Formally δ.
   */
  abstract get transitions(): Generator<[State, Letter, State]>;

  /**
   * The state upon which this automata starts.
   * Formally q[0] ∈ Q.
   */
  abstract get start(): State;

  /**
   * The states which count as accept.
   * Formally F ⊆ Q.
   */
  abstract get accepting(): Set<State>;

  *aggregatedTransitions(): Generator<[State, Letter[], State]> {
    const map = new DefaultMap<State, DefaultMap<State, Letter[]>>(
      (_) => new DefaultMap((_) => [] as Letter[])
    );

    for (const [source, letter, target] of this.transitions) {
      map //
        .get(source) //
        .get(target) //
        .push(letter);
    }

    for (const [source, subMap] of map.entries()) {
      for (const [target, letters] of subMap.entries()) {
        yield [source, letters, target];
      }
    }
  }

  abstract dot(_: { blankStates?: boolean; renames?: Map<State, string> }): string;
}

type NFATransitions = DefaultMap<State, DefaultMap<string, Set<State>>>;
type DFATransitions = DefaultMap<State, Map<string, State>>;

export class NFA extends FiniteAutomata {
  constructor(
    public states: Set<State>,
    public alphabet: Set<string>,
    public _transitions: DefaultMap<State, Map<string, Set<State>>>,
    public start: State,
    public accepting: Set<State>
  ) {
    super();
  }

  static fromGlushkovConstruction(regularExpression: RegularExpression): NFA {
    /**
     * In case anyone tries to read this code, this is slightly convoluted
     * as it is directly copied from the dart code, which has features that make
     * some of these lines easier.
     *
     * For some notation:
     *   Linearized Regular expression
     *     - A regular expression which has each of the characters uniquely indexed.
     *     - These essentially become the states of the automata.
     *     - If an expression is (ab), linearized it becomes (a[1]b[2]).
     *   P
     *     - The set of all linearized prefix letters.
     *     - These are the linearized letters which the start state is connected to.
     *     - If a linearized expression is (a[0]b[1])|(b[2]), then P = {a[0], b[2]}.
     *   D
     *     - The set of all linearized suffix letters.
     *     - These are the letters which the automata can end in.
     *     - If a linearized expression is (a[0]b[1])|(b[2]), then D = {b[1], b[2]}.
     *  F
     *     - The set of all pairs of linearized letters.
     *     - These essentially are the transitions in the automata.
     *     - If a linearized expression is (a[0]b[1])|(b[2]), then F = { (a[0], b[1]) }.
     *     - Repetition such as Kleene Star generates extra pairs for F.
     *
     *  q[0]
     *    - Represents the start state with label "1".
     *    - This is from the algorithm description.
     *  q[α]
     *    - Represents the state generated from the letter 'α'.
     */
    const linearized = regularExpression.getLinearized();

    /// The set P.
    const prefixes = new Set<Letter>(linearized.getPrefixes());

    /// The set D.
    const suffixes = new Set<Letter>(linearized.getSuffixes());

    /// The set F.
    const pairs = new Set<[Letter, Letter]>(linearized.getPairs());

    /// q[0].
    const start = new State(0, "1");

    /// This is needed as each 'letter' stands as its own object despite being unlinearized.
    const _uniqueLetter = new Map<string, Letter>();
    for (const letter of regularExpression.getLetters()) {
      _uniqueLetter.set(letter.rawLetter, letter);
    }

    /// Σ
    const alphabet = new Set<string>(_uniqueLetter.keys());

    const states = new Set<State>([start]);
    const accepting = new Set<State>();
    if (regularExpression.isNullable) {
      accepting.add(start);
    }

    /**
     * Each linearized letter becomes its very own Glushkov state.
     */
    for (const letter of linearized.getLetters()) {
      const stateName = letter.toString();
      const state = new State(letter.id!, stateName);
      states.add(state);

      /**
       * If the set of suffixes contains this letter, then we add the state to the accepting states.
       */
      if (suffixes.has(letter)) {
        accepting.add(state);
      }
    }

    /**
     * Build the transitions.
     *
     * In the original implementation, the map is defined as:
     *  δ: (State, Letter) -> State.
     *
     * However, since JavaScript does not support immutable tuples, nested maps will do.
     */
    const transitions: NFATransitions = new DefaultMap((_) => new DefaultMap((_) => new Set()));

    /**
     * Each letter in P is connected from q[0] by that letter.
     */
    for (const letter of prefixes) {
      const rightState = [...states].filter((state) => state.id == letter.id)[0];

      transitions.get(start).get(letter.rawLetter).add(rightState);
    }

    /**
     * Each [α, β] in F is connected from q[α] to q[β] by β.
     */
    for (const [left, right] of pairs) {
      const leftState = [...states].filter((state) => state.id == left.id)[0];
      const rightState = [...states].filter((state) => state.id == right.id)[0];

      transitions.get(leftState).get(right.rawLetter).add(rightState);
    }

    return new NFA(states, alphabet, transitions, start, accepting);
  }


  get transitions(): Generator<[State, Letter, State]> {
    return function* (this: NFA) {
      for (const [state, subMap] of this._transitions.entries()) {
        for (const [letter, targets] of subMap.entries()) {
          for (const target of targets) {
            yield [state, letter, target];
          }
        }
      }
    }.call(this) as Generator<[State, Letter, State]>;
  }

  accepts(str: string): boolean {
    const states = this.epsilonClosure(new Set([this.start]));
    const tokens = str.split("");

    for (const token of tokens) {
      const newStates = new Set([...states].flatMap((s) => [...this.transitionFrom(s, token)]));

      states.clear();
      for (const s of newStates) {
        states.add(s);
      }
    }

    return [...states].filter((i) => this.accepting.has(i)).length > 0;
  }

  acceptsDetailed(str: string): [Set<State>, boolean] {
    const states = this.epsilonClosure(new Set([this.start]));
    const tokens = str.split("");

    for (const token of tokens) {
      const newStates = new Set([...states].flatMap((s) => [...this.transitionFrom(s, token)]));

      states.clear();
      for (const s of newStates) {
        states.add(s);
      }
    }

    return [new Set<State>(states), [...states].filter((i) => this.accepting.has(i)).length > 0];
  }

  generateSimulationSteps(str: string): NFAStep[] {
    const output: NFAStep[] = [];

    /**
     * [1]: The first step will always be showing the resolution of the initial states.
     */

    const states = this.epsilonClosure(new Set([this.start]));

    output.push({
      resultStates: states,
      transitions: [...this.#epsilonClosureSteps(this.start)],
      identifier: "initial",
    });

    /**
     * [2]: We then yield the states resolved from [1].
     */
    output.push({ scannedIndex: -1, states: new Set(states), identifier: "state" });

    /**
     * For each transition,
     *  [n]    : we show the transition,
     *  [n + 1]: and we show the resulting states.
     */
    for (let i = 0; i < str.length; ++i) {
      const token = str[i];
      const transitions: [State, State][] = [];
      const newStates = new Set<State>();

      if (!this.alphabet.has(token)) {
        output.push({
          scannedIndex: i,
          identifier: "error",
        });

        return output;
      }

      for (const source of states) {
        for (const target of this._transitions.get(source).get(token)!) {
          newStates.add(target);
          transitions.push([source, target]);
        }
      }

      /// We resolve the epsilon transitions, breadth-first.
      for (const transition of this.#epsilonClosureSteps(newStates)) {
        transitions.push(transition);
      }

      const actualNewStates = new Set(
        [...states].flatMap((s) => [...this.transitionFrom(s, token)])
      );

      output.push({
        scannedIndex: i,
        transitions: transitions,
        resultStates: new Set(actualNewStates),
        identifier: "transition",
      });


      states.clear();
      for (const s of actualNewStates) {
        states.add(s);
      }

      if (actualNewStates.size <= 0) break;

      output.push({ scannedIndex: i, states: actualNewStates, identifier: "state" });
    }

    /**
     * [f]: We show the result of the automata.
     */

    if (states.size <= 0) {
      output.push({
        finalStates: null,
        status: "immature-abort",
        identifier: "complete",
      });
    } else if ([...states].some((s) => this.accepting.has(s))) {
      output.push({
        finalStates: new Set(states), //
        status: "recognized",
        identifier: "complete",
      });
    } else {
      output.push({
        finalStates: new Set(states),
        status: "not-recognized",
        identifier: "complete",
      });
    }

    return output;
  }

  *#epsilonClosureSteps(initial: State | Set<State>): Generator<[State, State]> {
    const seen = new Set<State>();
    const stack: State[] = [];

    if (initial instanceof State) {
      seen.add(initial);
      stack.push(initial);
    } else {
      for (const state of initial) {
        seen.add(state);
        stack.unshift(state);
      }
    }

    while (stack.length > 0) {
      const latest = stack.pop()!;

      const subMap = this._transitions.get(latest);
      if (!subMap.has(epsilon.rawLetter)) continue;
      for (const target of subMap.get(epsilon.rawLetter)!) {
        yield [latest, target];

        if (!seen.has(target)) {
          seen.add(target);
          stack.push(target);
        }
      }
    }
  }

  /**
   * Returns all of the states reachable from the [state] by [letter] and epsilon transitions.
   * @param state The input state from which the machine needs to transition from.
   * @param letter The letter which will be used for transitioning.
   * @returns The set of all states reachable from the transition, including epsilon transitions.
   */
  transitionFrom(state: State, letter: string) {
    const states = new Set<State>();
    for (const target of this._transitions.get(state)?.get(letter) ?? []) {
      states.add(target);
    }

    return this.epsilonClosure(states);
  }

  /**
   * A special case of the epsilon-closure, which only returns non-intermediate states.
   * @param stateInput The set of states which work as a source state.
   * @returns All of the (non-intermediate) states reachable by epsilon transitions.
   */
  epsilonClosure(stateInput: Set<State>): Set<State> {
    const seen = new Set<State>();
    const states = new Set<State>();

    /**
     * A state can be said to be "intermediate" if the only outward transition
     *  from the state is an epsilon transition.
     */
    const isIntermediate = (state: State): boolean =>
      this._transitions.get(state).has(epsilon.rawLetter) && this._transitions.get(state).size <= 1;

    const stack = [...stateInput];
    while (stack.length > 0) {
      const current = stack.pop()!;

      if (!isIntermediate(current)) {
        states.add(current);
      }

      if (!this._transitions.get(current).has(epsilon.rawLetter)) continue;
      for (const target of this._transitions.get(current).get(epsilon.rawLetter)!) {
        if (!seen.has(target)) {
          seen.add(target);

          if (!isIntermediate(target)) {
            states.add(target);
          }

          stack.push(target);
        }
      }
    }

    return states;
  }

  toDFA({ includeDeadState = false }): DFA {
    const states = new Set<State>();
    const alphabet = new Set<string>(this.alphabet);
    /// DFAs are not allowed to have epsilon transitions.
    alphabet.delete(epsilon.rawLetter);

    const transitions: DFATransitions = new DefaultMap((_) => new Map());
    const accepting = new Set<State>();
    const stateCounter = new Map<string, number>();

    const createLabel = (stateSet: Set<State>): string => {
      const labels = [...stateSet].map((s) => s.label);
      labels.sort();

      return `{ ${labels.join(", ")} }`;
    };
    const createOrGetState = (stateSet: Set<State>): [boolean, State] => {
      const label = createLabel(stateSet);
      const matches = [...states].filter((s) => s.label == label);

      let state;
      if (matches.length > 0) {
        state = matches[0];
      } else {
        if (stateCounter.get(label) == null) {
          stateCounter.set(label, stateCounter.size);
        }

        const id = stateCounter.get(label)!;
        state = new State(id, label);
      }

      if ([...stateSet].some((s) => this.accepting.has(s))) {
        accepting.add(state);
      }

      const isNew = !states.has(state);
      if (isNew) {
        states.add(state);
      }

      return [isNew, state];
    };

    const queue = [this.epsilonClosure(new Set([this.start]))];
    const [_, start] = createOrGetState(queue[0]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const [_, fromState] = createOrGetState(current);

      for (const letter of alphabet) {
        const nextStates = new Set<State>();
        for (const from of current) {
          for (const target of this.transitionFrom(from, letter)) {
            nextStates.add(target);
          }
        }

        if (!includeDeadState && nextStates.size <= 0) {
          continue;
        }

        const [isNew, toState] = createOrGetState(nextStates);

        if (transitions.get(fromState) == null) {
          transitions.set(fromState, new Map());
        }
        transitions.get(fromState).set(letter, toState);

        if (isNew) {
          queue.push(nextStates);
        }
      }
    }

    return new DFA(states, alphabet, transitions, start, accepting);
  }

  dot({
    blankStates = false,
    renames = null,
  }: {
    blankStates?: boolean;
    renames?: Map<State, string> | null;
  }): string {
    const buffer: string[] = ["digraph G {\n"];

    buffer.push("  rankdir=LR;\n");
    buffer.push("  graph[nodesep=.2,bgcolor=none];\n");

    buffer.push(`  n__ [label="" shape=none width=.0];\n`);
    for (const state of this.states) {
      buffer.push(`  ${state.id} [shape=`);
      buffer.push(this.accepting.has(state) ? `doublecircle` : `circle`);
      buffer.push(` label="`);

      const rename = renames?.get(state);
      if (rename != null) {
        buffer.push(rename);
      } else if (blankStates) {
        buffer.push("");
      } else {
        buffer.push(state.label);
      }
      buffer.push(`"]\n;`);
    }
    buffer.push(`  n__ -> ${this.start.id};`);

    for (const [source, letters, target] of this.aggregatedTransitions()) {
      const transitionLabel = letters.map((v) => v || "ε").join(", ");

      buffer.push(`  ${source.id} -> ${target.id} [label="${transitionLabel}"]\n`);
    }

    buffer.push("}\n");

    return buffer.join("");
  }
}

export class DFA extends FiniteAutomata {
  constructor(
    public states: Set<State>,
    public alphabet: Set<string>,
    public _transitions: DefaultMap<State, Map<string, State>>,
    public start: State,
    public accepting: Set<State>
  ) {
    super();
  }

  get transitions(): Generator<[State, Letter, State]> {
    return function* (this: DFA) {
      for (const [state, subMap] of this._transitions.entries()) {
        for (const [letter, targets] of subMap.entries()) {
          yield [state, letter, targets];
        }
      }
    }.call(this) as Generator<[State, Letter, State]>;
  }

  accepts(str: string): boolean {
    let state = this.start;
    const tokens = str.split("");

    for (const token of tokens) {
      state = this._transitions.get(state).get(token)!;

      if (state == null) return false;
    }

    return this.accepting.has(state);
  }

  acceptsDetailed(str: string): [State, boolean] {
    let state = this.start;
    const tokens = str.split("");

    for (const token of tokens) {
      state = this._transitions.get(state).get(token)!;
    }

    return [state, this.accepting.has(state)];
  }

  minimized() {
    const nf = new Set<State>([...this.states].filter((v) => !this.accepting.has(v)));
    const p = new Set<Set<State>>([this.accepting, nf]);
    const w = new Set<Set<State>>([this.accepting, nf]);

    while (w.size > 0) {
      const a = [...w][0];
      w.delete(a);

      for (const c of this.alphabet) {
        /// let X be the set of states for which a transition on c leads to a state in A
        const x = new Set<State>();
        for (const state of this.states) {
          if ([...a].some((v) => this._transitions.get(state)?.get(c) == v)) {
            x.add(state);
          }
        }

        for (const y of [...p]) {
          const yIx = new Set([...y].filter((v) => x.has(v)));
          const yDx = new Set([...y].filter((v) => !x.has(v)));

          if (yIx.size <= 0 || yDx.size <= 0) continue;

          p.delete(y);
          p.add(yIx);
          p.add(yDx);

          if (w.has(y)) {
            w.delete(y);
            w.add(yIx);
            w.add(yDx);
          } else {
            if (yIx.size <= yDx.size) {
              w.add(yIx);
            } else {
              w.add(yDx);
            }
          }
        }
      }
    }

    const createLabel = (stateSet: Set<State>): string => {
      const labels = [...stateSet].map((s) => s.label);
      labels.sort();

      return labels.join(", ");
    };

    const equivalentStates = new Map<State, State>();
    let i = 0;

    /// The equivalence classes are now in [p].
    for (const v of p) {
      const resulting = new State(i, createLabel(v));

      for (const original of v) {
        equivalentStates.set(original, resulting);
      }
      i += 1;
    }

    const states = new Set(equivalentStates.values());
    const alphabet = this.alphabet;
    const transitions: DFATransitions = new DefaultMap((_) => new Map());
    for (const [origin, subMap] of this._transitions.entries()) {
      for (const [letter, target] of subMap.entries()) {
        const equivalentOrigin = equivalentStates.get(origin)!;
        const equivalentTarget = equivalentStates.get(target)!;

        transitions.get(equivalentOrigin).set(letter, equivalentTarget);
      }
    }

    const start = equivalentStates.get(this.start)!;

    const accepting = new Set<State>();
    for (const state of this.accepting) {
      accepting.add(equivalentStates.get(state)!);
    }

    return new DFA(states, alphabet, transitions, start, accepting);
  }

  generateSimulationSteps(str: string): DFAStep[] {
    const output: DFAStep[] = [];

    /**
     * [1]: The first step will always be showing the resolution of the initial states.
     */

    let state: State | undefined = this.start;
    output.push({
      startState: state,
      identifier: "initial",
    });

    /**
     * [2]: We then yield the states resolved from [1].
     */
    output.push({ scannedIndex: -1, state, identifier: "state" });

    /**
     * For each transition,
     *  [n]    : we show the transition,
     *  [n + 1]: and we show the resulting states.
     */
    for (let i = 0; i < str.length; ++i) {
      const token = str[i];

      if (!this.alphabet.has(token)) {
        output.push({
          scannedIndex: i,
          identifier: "error",
        });

        return output;
      }

      const previousState = state;
      state = this._transitions.get(state).get(token);
      if (state == null) {
        output.push({
          scannedIndex: i,
          transition: null,
          resultState: null,
          identifier: "transition",
        });
        break;
      }

      output.push({
        scannedIndex: i,
        transition: [previousState, state],
        resultState: state,
        identifier: "transition",
      });

      output.push({ scannedIndex: i, state, identifier: "state" });
    }

    /**
     * [f]: We show the result of the automata.
     */
    if (state == null) {
      output.push({
        finalState: null,
        status: "immature-abort",
        identifier: "complete",
      })
    } else if (this.accepting.has(state)) {
      output.push({
        finalState: state,
        status: "recognized",
        identifier: "complete",
      });
    } else {
      output.push({
        finalState: state,
        status: "not-recognized",
        identifier: "complete",
      });
    }

    return output;
  }

  dot({
    blankStates = false,
    renames = null,
  }: {
    blankStates?: boolean;
    renames?: Map<State, string> | null;
  }): string {
    const buffer: string[] = ["digraph G {\n"];

    buffer.push("  rankdir=LR;\n");
    buffer.push("  graph[nodesep=.2,bgcolor=none];\n");

    buffer.push(`  n__ [label="" shape=none width=.0];\n`);
    for (const state of this.states) {
      buffer.push(`  ${state.id} [`);
      buffer.push(`shape=`);
      buffer.push(this.accepting.has(state) ? `doublecircle` : `circle`);
      buffer.push(` label="`);

      const rename = renames?.get(state);
      if (rename != null) {
        buffer.push(rename);
      }
      /// Trap state.
      else if (state.isTrapState) {
        buffer.push("∅");
      } else if (blankStates) {
        buffer.push("");
      } else {
        buffer.push(state.label);
      }
      buffer.push(`"]\n;`);
    }
    buffer.push(`  n__ -> ${this.start.id};`);
    for (const [source, letters, target] of this.aggregatedTransitions()) {
      const transitionLabel = letters.map((v) => v.toString()).join(", ");

      buffer.push(`  ${source.id} -> ${target.id} [label="${transitionLabel}"]\n`);
    }

    buffer.push("}\n");

    return buffer.join("");
  }
}
