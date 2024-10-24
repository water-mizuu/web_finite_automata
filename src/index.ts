import { instance } from "@viz-js/viz";
import { NFA } from "./automata";
import {
  Choice,
  Concatenation,
  KleeneStar,
  Letter,
} from "./regular_expression";

const viz = await instance();

const regex = new Concatenation(
  new Choice(new Letter("a"), new Letter("b")),
  new KleeneStar(new Letter("c")),
);
const nfa = NFA.fromGlushkovConstruction(regex);
const svg = viz.renderSVGElement(nfa.dot());
document.getElementById("graphviz-output").appendChild(svg);
