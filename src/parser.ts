import {
  Choice,
  Concatenation,
  KleenePlus,
  KleeneStar,
  Letter,
  Optional,
  RegularExpression,
} from "./regular_expression";

export const parse = (text: string): RegularExpression => {
  const regex = (pattern: RegExp, str: string): [string, string | null] => {
    const match = str.match(pattern);
    if (match != null) {
      return [str.substring(match[0].length), match[0]];
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

  parseChoice = (string: string) => {
    let [remaining, left] = parseConcatenation(string);
    if (left == null) return [string, null];

    do {
      let [remaining1, op] = expect("|", remaining);
      if (op == null) break;

      let [remaining2, right] = parseConcatenation(remaining1);
      if (right == null) break;

      [remaining, left] = [remaining2, new Choice(left, right)];
    } while (left != null);

    return [remaining, left];
  };

  parseConcatenation = (string: string) => {
    let [remaining, left] = parsePostfix(string);
    if (left == null) return [string, null];

    do {
      let [remaining1, right] = parsePostfix(remaining);
      if (right == null) break;

      [remaining, left] = [remaining1, new Concatenation(left, right)];
    } while (left != null);

    return [remaining, left];
  };

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
    } while (body != null);

    return [remaining, body];
  };

  parseAtom = (string: string): [string, RegularExpression | null] => {
    let [remaining1, lParen] = expect("(", string);
    if (lParen != null) {
      let [remaining2, inner] = parseChoice(remaining1);
      if (inner == null) return [string, null];

      let [remaining3, rParen] = expect(")", remaining2);
      if (rParen == null) return [string, null];

      return [remaining3, inner];
    }

    let [remaining2, value] = regex(/^[A-Za-z0-9]/, string);
    if (value != null) {
      return [remaining2, new Letter(value)];
    }

    return [string, null];
  };

  return parseChoice(text)[1];
};
