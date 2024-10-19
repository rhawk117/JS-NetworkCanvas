// point.js

/**
 * @class - a point in a 2D space
 * @property {number} x - the x coordinate
 * @property {number} y - the y coordinate
 */
export class Point {
  constructor(width, height, justification) {
    this.setPoint(width, height, justification);
  }

  setPoint(width, height, justification) {
    const setAxis = (pos) => {
      if (Math.random() < 0.7) {
        return justifyPosition(pos, justification);
      } else {
        return Math.random() * pos;
      }
    };
    this.x = setAxis(width);
    this.y = setAxis(height);
  }
  /**
   * factory method to create a point
   * @param {String} justification - 'random', 'center', 'corner'
   * @param {Object{ width: Number, height: Number }} dimensions
   * @returns {Point}
   */
  static create(justification, dimensions) {
    const { width, height } = dimensions;
    return new Point(width, height, justification);
  }
  equals(point) {
    return this.x === point.x && this.y === point.y;
  }
}

const justifyPosition = (pos, justify) => {
  const justifyCorner = (axis) => {
    if (Math.random() < 0.5) {
      return Math.random() * (axis * 0.2);
    } else {
      return Math.random() * (axis * 0.2) + axis * 0.8;
    }
  };

  switch (justify) {
    case "random":
      return Math.random() * pos;
    case "center":
      return (Math.random() - 0.5) * (pos * 0.4) + pos / 2;
    default: // 'corner' or default
      return justifyCorner(pos);
  }
};
