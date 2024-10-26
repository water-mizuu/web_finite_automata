import {
  Choice,
  Concatenation,
  epsilon,
  KleenePlus,
  KleeneStar,
  Letter,
  Optional,
  RegularExpression,
} from "./regular_expression";

/**
 * Parses [text] into a regular expression object which can be used for manipulation and simulation.
 * It follows a hybrid of parser combinator and recursive descent techniques.
 * 
 * This should probably be a class, but whatever.
 * @param text Input text
 * @returns A [RegularExpression] object which follows the input text.
 */
export const parse = (text: string): RegularExpression | null => {
  const any = (str: string): [string, string | null] => {

    if (str.length > 0 &&
      str[0] !== "(" &&
      str[0] !== ")" &&
      str[0] !== "|" &&
      str[0] !== "*" &&
      str[0] !== "+" &&
      str[0] !== "*") {
      return [str.substring(1), str[0]];
    }

    return [str, null];
  };
  const expect = (pattern: string, str: string): [string, string | null] => {
    if (str.startsWith(pattern)) {
      return [str.substring(pattern.length), pattern];
    }
    return [str, null];
  };

  let parseChoice: (_: string) => [string, RegularExpression | null],
    parseConcatenation: (_: string) => [string, RegularExpression | null],
    parsePostfix: (_: string) => [string, RegularExpression | null],
    parseAtom: (_: string) => [string, RegularExpression | null];

  /// choice = concat ("|" concat)*
  parseChoice = (string: string) => {
    let [remaining, left] = parseConcatenation(string);
    if (left == null) return [string, null];

    do {
      let [remaining1, op] = expect("|", remaining);
      if (op == null) break;

      let [remaining2, right] = parseConcatenation(remaining1);
      if (right == null) break;

      [remaining, left] = [remaining2, new Choice(left, right)];
    } while (true);

    return [remaining, left];
  };

  /// concat = postfix postfix*
  parseConcatenation = (string: string) => {
    let [remaining, left] = parsePostfix(string);
    if (left == null) return [string, null];

    do {
      let [remaining1, right] = parsePostfix(remaining);
      if (right == null) break;

      [remaining, left] = [remaining1, new Concatenation(left, right)];
    } while (true);

    return [remaining, left];
  };

  /// postfix = atom ("+"|"*"|"?")*
  parsePostfix = (string: string) => {
    let [remaining, body] = parseAtom(string);
    if (body == null) return [string, null];

    do {
      let [remaining1, op1] = expect("+", remaining);
      if (op1 != null) {
        [remaining, body] = [remaining1, new KleenePlus(body)];
        continue;
      }

      let [remaining2, op2] = expect("*", remaining);
      if (op2 != null) {
        [remaining, body] = [remaining2, new KleeneStar(body)];
        continue;
      }

      let [remaining3, op3] = expect("?", remaining);
      if (op3 != null) {
        [remaining, body] = [remaining3, new Optional(body)];
        continue;
      }

      break;
    } while (true);

    return [remaining, body];
  };

  /// atom = "(" choice ")" | !"(" !")" !"*" !"+" !"?" any
  parseAtom = (string: string): [string, RegularExpression | null] => {
    let [remaining1, lParen] = expect("(", string);
    if (lParen != null) {
      let [remaining2, inner] = parseChoice(remaining1);
      if (inner == null) return [string, null];

      let [remaining3, rParen] = expect(")", remaining2);
      if (rParen == null) return [string, null];

      return [remaining3, inner];
    }

    let [remaining2, value] = any(string);
    if (value == "ε") {
      return [remaining2, epsilon];
    } else if (value != null) {
      return [remaining2, new Letter(value)];
    }

    return [string, null];
  };

  const [remaining, regularExpression] = parseChoice(text);

  if (remaining.length > 0) {
    console.warn(`The parsed text did not end with EOF. Ending: '${remaining}'`);
  }

  return regularExpression;
};
