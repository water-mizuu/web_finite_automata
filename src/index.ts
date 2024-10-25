import { instance } from "@viz-js/viz";
import { NFA } from "./automata";
import { parse } from "./parser";

const viz = await instance();

const textInput = document.getElementById("regex-input");
const button = document.getElementById("regex-button");
button.addEventListener("click", () => {
  const regex = parse((textInput as HTMLInputElement).value);

  const nfa = NFA.fromGlushkovConstruction(regex);
  const svg = viz.renderSVGElement(nfa.dot());

  /// We remove the children forcefully.
  document.getElementById("graphviz-output").innerHTML = "";
  document.getElementById("graphviz-output").appendChild(svg);
});
