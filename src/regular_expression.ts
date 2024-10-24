export abstract class RegularExpression {
  abstract getPrefixes(): Generator<Letter>;
  abstract getSuffixes(): Generator<Letter>;
  abstract getPairs(): Generator<[Letter, Letter]>;
  abstract getLetters(): Generator<Letter>;
  abstract get isNullable(): boolean;

  getLinearized(): RegularExpression {
    return this._getLinearized(1)[1];
  }

  abstract _getLinearized(start: number): [number, RegularExpression];
}

export class Letter extends RegularExpression {
  constructor(public rawLetter: string, public id?: number) {
    super();

    if (rawLetter.length > 1) {
      throw new Error(
        `RegularExpression [Letter] only supports 1-length strings!`,
      );
    }
  }

  override *getPrefixes() {
    yield this;
  }
  override *getSuffixes() {
    yield this;
  }
  override *getPairs() {}
  override *getLetters() {
    yield this;
  }
  override get isNullable(): boolean {
    return false;
  }
  override _getLinearized(start: number): [number, RegularExpression] {
    return [start + 1, new Letter(this.rawLetter, start)];
  }

  override toString() {
    return `${this.rawLetter}${this.id == null ? "" : `[${this.id}]`}`;
  }
}

class Epsilon extends Letter {
  constructor(id?: number) {
    super("", id);
  }

  toString() {
    return "ε";
  }

  override get isNullable(): boolean {
    return true;
  }

  override _getLinearized(start: number): [number, RegularExpression] {
    return [start + 1, new Letter(this.rawLetter, start)];
  }
}

export const epsilon = new Epsilon();

export class Choice extends RegularExpression {
  constructor(public left: RegularExpression, public right: RegularExpression) {
    super();
  }

  override *getPrefixes() {
    yield* this.left.getPrefixes();
    yield* this.right.getPrefixes();
  }

  override *getSuffixes() {
    yield* this.left.getSuffixes();
    yield* this.right.getSuffixes();
  }

  override *getPairs() {
    yield* this.left.getPairs();
    yield* this.right.getPairs();
  }

  override *getLetters() {
    yield* this.left.getLetters();
    yield* this.right.getLetters();
  }

  override get isNullable(): boolean {
    return this.left.isNullable || this.right.isNullable;
  }

  override _getLinearized(start: number): [number, RegularExpression] {
    const [start1, left] = this.left._getLinearized(start);
    const [start2, right] = this.right._getLinearized(start1);

    return [start2, new Choice(left, right)];
  }
}

export class Concatenation extends RegularExpression {
  constructor(public left: RegularExpression, public right: RegularExpression) {
    super();
  }

  override *getPrefixes() {
    yield* this.left.getPrefixes();

    if (this.left.isNullable) {
      yield* this.right.getPrefixes();
    }
  }

  override *getSuffixes() {
    yield* this.right.getSuffixes();

    if (this.right.isNullable) {
      yield* this.left.getSuffixes();
    }
  }

  override *getPairs(): Generator<[Letter, Letter]> {
    yield* this.left.getPairs();
    yield* this.right.getPairs();

    for (const left of this.left.getSuffixes()) {
      for (const right of this.right.getPrefixes()) {
        yield [left, right];
      }
    }
  }

  override *getLetters(): Generator<Letter> {
    yield* this.left.getLetters();
    yield* this.right.getLetters();
  }

  override get isNullable(): boolean {
    return this.left.isNullable && this.right.isNullable;
  }

  override _getLinearized(start: number): [number, RegularExpression] {
    const [start1, left] = this.left._getLinearized(start);
    const [start2, right] = this.right._getLinearized(start1);

    return [start2, new Concatenation(left, right)];
  }
}

export class Optional extends RegularExpression {
  constructor(public expression: RegularExpression) {
    super();
  }

  override *getPrefixes() {
    yield* this.expression.getPrefixes();
  }

  override *getSuffixes() {
    yield* this.expression.getSuffixes();
  }

  override *getPairs() {
    yield* this.expression.getPairs();
  }

  override *getLetters() {
    yield* this.expression.getLetters();
  }

  override get isNullable(): boolean {
    return true;
  }

  override _getLinearized(start: number): [number, RegularExpression] {
    const [end, expression] = this.expression._getLinearized(start);

    return [end, new Optional(expression)];
  }
}

export class KleeneStar extends RegularExpression {
  constructor(public expression: RegularExpression) {
    super();
  }

  override *getPrefixes() {
    yield* this.expression.getPrefixes();
  }

  override *getSuffixes() {
    yield* this.expression.getSuffixes();
  }

  override *getPairs(): Generator<[Letter, Letter]> {
    yield* this.expression.getPairs();

    /// Since we can repeat ourselves, we can also pair the prefixes and suffixes of the expression.
    for (const suffix of this.expression.getSuffixes()) {
      for (const prefix of this.expression.getPrefixes()) {
        yield [suffix, prefix];
      }
    }
  }

  override *getLetters() {
    yield* this.expression.getLetters();
  }

  override get isNullable(): boolean {
    return true;
  }

  override _getLinearized(start: number): [number, RegularExpression] {
    const [end, expression] = this.expression._getLinearized(start);

    return [end, new KleeneStar(expression)];
  }
}

export class KleenePlus extends RegularExpression {
  constructor(public expression: RegularExpression) {
    super();
  }

  override *getPrefixes() {
    yield* this.expression.getPrefixes();
  }

  override *getSuffixes() {
    yield* this.expression.getSuffixes();
  }

  override *getPairs(): Generator<[Letter, Letter]> {
    yield* this.expression.getPairs();

    /// Since we can repeat ourselves, we can also pair the prefixes and suffixes of the expression.
    for (const suffix of this.expression.getSuffixes()) {
      for (const prefix of this.expression.getPrefixes()) {
        yield [suffix, prefix];
      }
    }
  }

  override *getLetters() {
    yield* this.expression.getLetters();
  }

  override get isNullable(): boolean {
    return this.expression.isNullable;
  }

  override _getLinearized(start: number): [number, RegularExpression] {
    const [end, expression] = this.expression._getLinearized(start);

    return [end, new KleenePlus(expression)];
  }
}

// extension RegularExpressionExtension on RegularExpression {
//   RegularExpression operator |(RegularExpression other) => Choice(this, other);
//   RegularExpression operator &(RegularExpression other) => Concatenation(this, other);
//   RegularExpression get star => KleeneStar(this);
//   RegularExpression get plus => KleenePlus(this);
//   RegularExpression get optional => Optional(this);
// }

// extension StringExtension on String {
//   Letter get r => Letter(this);
// }

// extension on String {
//   String get parenthesize => switch (split("")) {
//         ["(", ..., ")"] => this,
//         _ => "($this)",
//       };
// }
