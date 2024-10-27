import { $ } from "./utility";

export const regexInput = $("regex-input") as HTMLInputElement;
export const stringInput = $("string-input") as HTMLInputElement;
export const recognizeOutput = $("match-result") as HTMLDivElement;

export const dfaSwitch = $(`dfa-switch`) as HTMLInputElement;
export const minimalDfaSwitch = $(`minimal-dfa-switch`) as HTMLInputElement;