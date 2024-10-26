import { Letter, RegularExpression } from "./regular_expression";


export class State {
  constructor(
    public id: number,
    public label: string
  ) { }
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
  abstract get alphabet(): Set<Letter>;

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
    const map = new Map<State, Map<State, Letter[]>>();
    for (const [source, letter, target] of this.transitions) {
      if (map.get(source) == null) {
        map.set(source, new Map());
      }

      if (map.get(source).get(target) == null) {
        map.get(source).set(target, []);
      }

      map//
        .get(source)//
        .get(target)//
        .push(letter);
    }

    for (const [source, subMap] of map.entries()) {
      for (const [target, letters] of subMap.entries()) {
        yield [source, letters, target];
      }
    }
  }
}

export class NFA extends FiniteAutomata {
  constructor(
    public states: Set<State>,
    public alphabet: Set<Letter>,
    public _transitions: Map<State, Map<string, Set<State>>>,
    public start: State,
    public accepting: Set<State>
  ) {
    super();
  }

  get transitions(): Generator<[State, Letter, State]> {
    return function* (this: NFA) {
      for (const [state, subMap] of this._transitions.entries()) {
        for (const [rawLetter, targets] of subMap.entries()) {
          const letter = [...this.alphabet].filter(
            (v) => v.rawLetter == rawLetter
          )[0];

          for (const target of targets) {
            yield [state, letter, target];
          }
        }
      }
    }.call(this);
  }

  accepts(str: string): boolean {
    const states = new Set<State>([
      this.start,
      ...this.transitionFrom(this.start, ""),
    ]);
    const tokens = str.split("");

    for (const token of tokens) {
      const newStates = new Set(
        [...states].flatMap((s) => [...this.transitionFrom(s, token)])
      );

      states.clear();
      for (const s of newStates) {
        states.add(s);
      }
    }

    return [...states].filter((i) => this.accepting.has(i)).length > 0;
  }

  acceptsDetailed(str: string): [Set<State>, boolean] {
    const states = new Set<State>([
      this.start,
      ...this.transitionFrom(this.start, ""),
    ]);
    const tokens = str.split("");

    for (const token of tokens) {
      const newStates = new Set(
        [...states].flatMap((s) => [...this.transitionFrom(s, token)])
      );

      states.clear();
      for (const s of newStates) {
        states.add(s);
      }
    }

    return [new Set<State>(states), [...states].filter((i) => this.accepting.has(i)).length > 0];
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

    const stack = [...states];
    while (stack.length > 0) {
      const current = stack.pop();
      const epsilonTransitions = this._transitions.get(current)?.get("");
      if (epsilonTransitions == null) continue;

      for (const target of epsilonTransitions) {
        if (!states.has(target)) {
          states.add(target);
          stack.push(target);
        }
      }
    }

    return states;
  }

  toDFA({ includeDeadState = false }): DFA {
    const states = new Set<State>();
    const alphabet = new Set<Letter>(this.alphabet);
    const transitions = new Map<State, Map<string, State>>();
    const accepting = new Set<State>();

    const stateCounter = new Map<string, number>();

    const createLabel = (stateSet: Set<State>): string => {
      const labels = [...stateSet].map((s) => s.label);
      labels.sort();

      return labels.join(", ");
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

        console.log(stateCounter);
        const id = stateCounter.get(label);
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

    const queue = new Array<Set<State>>();
    queue.push(new Set([this.start, ...this.transitionFrom(this.start, "")]));
    const [_, start] = createOrGetState(queue[0]);
    while (queue.length > 0) {
      const current = queue.shift();
      console.log([...current].map(s => s.label).join(" "));
      const [_, fromState] = createOrGetState(current);

      for (const letter of alphabet) {
        const nextStates = new Set<State>();
        for (const from of current) {
          for (const target of this.transitionFrom(from, letter.rawLetter)) {
            nextStates.add(target);
          }
        }

        console.log({ letter: letter.rawLetter, nextStates });

        if (!includeDeadState && nextStates.size <= 0) {
          continue;
        }

        const [isNew, toState] = createOrGetState(nextStates);

        console.log({ isNew });
        if (transitions.get(fromState) == null) {
          transitions.set(fromState, new Map());
        }
        transitions.get(fromState).set(letter.rawLetter, toState);

        if (isNew) {
          queue.push(nextStates);
        }
      }
    }

    return new DFA(states, alphabet, transitions, start, accepting);
  }

  static fromGlushkovConstruction(regularExpression: RegularExpression) {
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
    const alphabet = new Set<Letter>(_uniqueLetter.values());

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
    const transitions = new Map<State, Map<string, Set<State>>>();
    for (const letter of alphabet) {
      if (transitions.get(start) == null) {
        transitions.set(start, new Map());
      }

      transitions.get(start).set(letter.rawLetter, new Set());
    }
    for (const state of states) {
      if (transitions.get(state) == null) {
        transitions.set(state, new Map());
      }

      for (const letter of alphabet) {
        transitions.get(state).set(letter.rawLetter, new Set());
      }
    }

    /**
     * Each letter in P is connected from q[0] by that letter.
     */
    for (const letter of prefixes) {
      const rightState = [...states].filter(
        (state) => state.id == letter.id
      )[0];

      transitions //
        .get(start) //
        .get(letter.rawLetter) //
        .add(rightState);
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

  dot({ blankStates = false }): string {
    const buffer: string[] = ["digraph G {\n"];

    buffer.push("  rankdir=LR;\n");

    buffer.push(`  n__ [label="" shape=none width=.0];\n`);
    for (const state of this.states) {
      buffer.push(`  ${state.id} [shape=`);
      buffer.push(this.accepting.has(state) ? `doublecircle` : `circle`);
      buffer.push(` label="`);
      if (blankStates) {
        buffer.push("");
      } else {
        buffer.push(state.label);
      }
      buffer.push(`"]\n;`);
    }
    buffer.push(`  n__ -> ${this.start.id};`);

    for (const [source, letters, target] of this.aggregatedTransitions()) {
      const transitionLabel = letters.map((v) => v.rawLetter).join(", ");

      buffer.push(`  ${source.id} -> ${target.id} [label="${transitionLabel}"]\n`);
    }

    buffer.push("}\n");

    return buffer.join("");
  }
}

export class DFA extends FiniteAutomata {
  constructor(
    public states: Set<State>,
    public alphabet: Set<Letter>,
    public _transitions: Map<State, Map<string, State>>,
    public start: State,
    public accepting: Set<State>
  ) {
    super();
  }

  get transitions(): Generator<[State, Letter, State]> {
    return function* (this: DFA) {
      for (const [state, subMap] of this._transitions.entries()) {
        for (const [rawLetter, targets] of subMap.entries()) {
          const letter = [...this.alphabet].filter(
            (v) => v.rawLetter == rawLetter
          )[0];

          yield [state, letter, targets];
        }
      }
    }.call(this);
  }

  accepts(str: string): boolean {
    let state = this.start;
    const tokens = str.split("");

    for (const token of tokens) {
      state = this._transitions.get(state).get(token);

      if (state == null) return false;
    }

    return this.accepting.has(state);
  }

  minimized() {
    const nf = new Set<State>([...this.states].filter(v => !this.accepting.has(v)));
    const p = new Set<Set<State>>([this.accepting, nf]);
    const w = new Set<Set<State>>([this.accepting, nf]);

    while (w.size > 0) {
      const a = [...w][0];
      w.delete(a);

      for (const c of this.alphabet) {
        /// let X be the set of states for which a transition on c leads to a state in A
        const x = new Set<State>();
        for (const state of this.states) {
          if ([...a].some((v) => this._transitions.get(state)?.get(c.rawLetter) == v)) {
            x.add(state);
          }
        }

        for (const y of [...p]) {
          const yIx = new Set([...y].filter(v => x.has(v)));
          const yDx = new Set([...y].filter(v => !x.has(v)));

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
    const transitions = new Map<State, Map<string, State>>();
    for (const [origin, subMap] of this._transitions.entries()) {
      for (const [letter, target] of subMap.entries()) {
        const equivalentOrigin = equivalentStates.get(origin);
        const equivalentTarget = equivalentStates.get(target);

        if (transitions.get(equivalentOrigin) == null) {
          transitions.set(equivalentOrigin, new Map());
        }

        transitions.get(equivalentOrigin).set(letter, equivalentTarget);
      }
    }

    const start = equivalentStates.get(this.start);
    console.log(start);

    const accepting = new Set<State>();
    for (const state of this.accepting) {
      accepting.add(equivalentStates.get(state));
    }

    return new DFA(states, alphabet, transitions, start, accepting);
  }


  dot({ blankStates = false }): string {
    const buffer: string[] = ["digraph G {\n"];

    buffer.push("  rankdir=LR;\n");

    buffer.push(`  n__ [label="" shape=none width=.0];\n`);
    for (const state of this.states) {
      buffer.push(`  ${state.id} [`);
      buffer.push(`shape=`)
      buffer.push(this.accepting.has(state) ? `doublecircle` : `circle`);
      buffer.push(` label="`);
      if (state.label == "") {
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
      const transitionLabel = letters.map((v) => v.rawLetter).join(", ");

      buffer.push(`  ${source.id} -> ${target.id} [label="${transitionLabel}"]\n`);
    }

    buffer.push("}\n");

    return buffer.join("");
  }
}
