export class Vector {
  static zero(): Vector {
    return new Vector(0, 0);
  }
  constructor(public x: number, public y: number) {}
}
