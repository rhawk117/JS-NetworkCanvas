// network-canvas.js

import { Point } from "./point.js";

// todo: getPositionOf, animate Node, extend CanvasNodes
// make a version that uses canvas instead of divs

/**
 * @enum {string}
 * represents the possible statuses of a node.
 */
const NodeStatus = Object.freeze({
  IDLE: "idle",
  ACTIVE: "active",
  SENDING: "sending",
});

/**
 * @enum {string}
 * represents the styles of lines between nodes.
 */
const LineStyle = Object.freeze({
  DOTTED: "dotted",
  SOLID: "solid",
});

/**
 * @typedef {Object} Config
 * @property {number} nodeCount - number of nodes in the network.
 * @property {number} frequency - frequency of node animations in milliseconds.
 * @property {string} justifyNodes - strategy for node justification.
 */

/**
 * configuration settings for the network canvas.
 * @type {Config}
 */
const config = {
  nodeCount: 250,
  frequency: 500,
  justifyNodes: "random",
};

/**
 * @typedef {Object} OverclockConfig
 * @property {Boolean} active - indicates if overclock mode is active.
 * @property {Number} interval - in milliseconds.
 * @property {Number} duration - duration in milliseconds.
 * @property {Number} chance - probability to trigger overclock mode.
 * @property {Number} fraction - fraction of nodes to connect during overclock.
 */

/**
 * configuration settings for overclock mode.
 * @type {OverclockConfig}
 */
const overclockConfig = {
  active: false,
  interval: 5000,
  duration: 5000,
  chance: 0.25,
  fraction: 0.75,
};

/**
 * calculates the dimensions and angle between two points.
 * @param {Point} start - the starting point.
 * @param {Point} end - the ending point.
 * @returns {{ length: number, angle: number, startX: number, startY: number }}
 */
const getLineDimensions = (start, end) => {
  const dX = end.x - start.x;
  const dY = end.y - start.y;
  return {
    length: Math.sqrt(dX ** 2 + dY ** 2),
    angle: (Math.atan2(dY, dX) * 180) / Math.PI,
    startX: start.x,
    startY: start.y,
  };
};

/**
 * retrieves the size of the canvas element.
 * @param {JQuery<HTMLElement>} $canvas - the jQuery canvas element.
 * @returns {{ width: number, height: number }}
 */

const getCanvasSize = ($canvas) => ({
  width: $canvas.width(),
  height: $canvas.height(),
});

/**
 * finds the network canvas element in the dom.
 * @throws will throw an error if the canvas is not found.
 * @returns {JQuery<HTMLElement>} the jQuery canvas element.
 */

const findCanvas = () => {
  const $canvas = $("#networkCanvas");
  if (!$canvas.length) {
    throw new Error("CanvasError: Canvas not found");
  }
  return $canvas;
};

/**
 * determines if a randomly generated number is less than the given chance.
 * @param {number} chance - probability threshold (0 to 1).
 * @returns {boolean} true if the random number is less than chance, else false.
 */
const probability = (chance) => {
  return Math.random() < chance;
};

/**
 * represents a single node in the network / graph.
 * @class
 * @property {number} id
 * @property {Point} position - the x, y of the node on the canvas.
 * @property {NodeStatus} status - current status of the node.
 * @property {JQuery<HTMLElement>} $element - the jQuery element representing the node in the dom.
 */
class Node {
  /**
   * creates a new node instance.
   * @param {{ width: number, height: number }} size - the size of the canvas.
   * @param {string} justification - the justification strategy for positioning.
   * @param {number} id - unique identifier for the node.
   */
  constructor(size, justification, id) {
    this.id = id;
    this.position = Point.create(justification, size);
    this.status = NodeStatus.IDLE;
    this.$element = this.create();
  }

  /**
   * creates the jquery element for the node.
   * @returns {JQuery<HTMLElement>} the jquery node element.
   */
  create() {
    return $("<div>", { class: "node" })
      .css({
        left: `${this.position.x}px`,
        top: `${this.position.y}px`,
      })
      .attr("data-id", this.id);
  }

  /**
   * updates the status of the node and its corresponding css classes.
   * @param {string} status - the new status of the node.
   */
  setStatus(status) {
    this.status = status;
    const oldStatus = Object.values(NodeStatus).join(" ");
    this.$element.removeClass(oldStatus).addClass(status);
  }

  /**
   * pulses the node a specified number of times with a given interval.
   * @param {number} [times=1] - number of pulses.
   * @param {number} [interval=300] - interval between pulses in milliseconds.
   * @returns {Promise<void>} resolves when pulsing is complete.
   */
  pulse(times = 1, interval = 300) {
    return new Promise((resolve) => {
      let count = 0;
      const doPulse = () => {
        if (count < times) {
          this.setStatus(NodeStatus.ACTIVE);
          setTimeout(() => {
            this.setStatus(NodeStatus.IDLE);
            count++;
            setTimeout(doPulse, interval);
          }, interval);
        } else {
          resolve();
        }
      };
      doPulse();
    });
  }

  /**
   * resizes the node by updating its position.
   * @param {Point} pos - the new position of the node.
   */
  resize(pos) {
    this.position = pos;
    this.$element.css({
      left: `${this.position.x}px`,
      top: `${this.position.y}px`,
    });
  }

  /**
   * creates a ripple effect on the node.
   */
  ripple() {
    const $ripple = $('<div class="ripple-effect"></div>');
    this.$element.append($ripple);
    setTimeout(() => $ripple.remove(), 1000);
  }

  /**
   * makes the node blink by toggling the 'blink' css class.
   */
  blink() {
    this.$element.addClass("blink");
    setTimeout(() => this.$element.removeClass("blink"), 1500);
  }
}

/**
 * manages a collection of node instances.
 * @class
 * @property {Node[]} nodes - array of node instances.
 * @property {number} count - total number of nodes.
 */
class CanvasNodes {
  /**
   * creates a new CanvasNodes instance.
   * @param {{ width: number, height: number }} size - the size of the canvas.
   * @param {string} justification - the justification strategy for positioning.
   * @param {number} count - number of nodes to create.
   * @param {JQuery<HTMLElement>} $container - the container to append nodes to.
   */
  constructor(size, justification, count, $container) {
    this.nodes = [];
    this.count = count;
    this.createAll(size, justification, count, $container);
  }

  /**
   * creates and appends all nodes to the container.
   * @param {{ width: number, height: number }} size
   * @param {String} justification
   * @param {Number} count - number of nodes to create.
   * @param {JQuery<HTMLElement>} $container - the container to append nodes to.
   */
  createAll(size, justification, count, $container) {
    for (let i = 0; i < count; i++) {
      const node = new Node(size, justification, this.makeNodeId(count, i));
      this.nodes.push(node);
      $container.append(node.$element);
    }
  }

  /**
   * generates a unique node id based on index.
   * @param {Number} count - total number of nodes.
   * @param {Number} k - current index.
   * @returns {Number} the generated node id.
   */
  makeNodeId(count, k) {
    const primeNum = 33;
    return (k + (Math.pow(k, 2) % primeNum)) % count;
  }

  /**
   * finds a node that satisfies the given predicate.
   * @param {(node: Node) => boolean} predicate - the condition to match.
   * @returns {Node|undefined} the first matching node or undefined.
   */
  findBy(predicate) {
    return this.nodes.find(predicate);
  }

  /**
   * finds a node by its unique id.
   * @param {number} id - the id of the node.
   * @returns {Node|undefined} the matching node or undefined.
   */
  findById(id) {
    return this.findBy((node) => node.id === id);
  }

  /**
   * finds all nodes with the specified status.
   * @param {string} status - the status to filter by.
   * @returns {Node[]} array of nodes with the given status.
   */
  findByStatus(status) {
    return this.nodes.filter((node) => node.status === status);
  }

  /**
   * selects a random subset of nodes, excluding specified nodes.
   * @param {number} [count=1] - number of random nodes to select.
   * @param {Node[]} [exclusions=[]] - nodes to exclude from selection.
   * @returns {Node[]} array of randomly selected nodes.
   */
  selectRandom(count = 1, exclusions = []) {
    const availableNodes = this.nodes.filter(
      (node) => !exclusions.includes(node)
    );
    const randomized = availableNodes.sort(() => 0.5 - Math.random());
    return randomized.slice(0, count);
  }

  /**
   * makes all nodes blink.
   */
  blinkAll() {
    this.nodes.forEach((node) => node.blink());
  }

  /**
   * resizes all nodes based on the new size and justification.
   * @param {{ width: number, height: number }} size - the new size of the canvas.
   * @param {string} justification - the justification strategy for positioning.
   */
  resizeAll(size, justification) {
    this.nodes.forEach((node) => {
      const pos = Point.create(justification, size);
      node.resize(pos);
    });
  }
  getAll() {
    return this.nodes;
  }
}

/**
 * represents a line between two nodes on the canvas.
 * @class
 * @property {JQuery<HTMLElement>} $element - representing the line in the dom.
 * @property {{ length: number, angle: number, startX: number, startY: number }} dimensions
 * @property {LineStyle} type - (dotted or solid).
 * @property {Function} onComplete - callback function to execute upon completion of the animation.
 * @property {boolean} isPathLine - indicates if the line is part of a path.
 */
class CanvasLine {
  /**
   * creates a new CanvasLine instance.
   * @param {Point} start - the starting point of the line.
   * @param {Point} end - the ending point of the line.
   * @param {Function} onComplete - callback function to execute upon completion.
   * @param {boolean} [isPathLine=false] - indicates if the line is part of a path.
   */
  constructor(start, end, onComplete, isPathLine = false) {
    this.$element = $('<div class="line"></div>');
    this.dimensions = getLineDimensions(start, end);
    this.type = probability(0.5) ? LineStyle.DOTTED : LineStyle.SOLID;
    this.onComplete = onComplete;
    this.isPathLine = isPathLine;
  }

  /**
   * draws the line by styling and animating it.
   */
  draw() {
    this.style();
    this.animate();
  }

  /**
   * styles the line element based on its dimensions and type.
   */
  style() {
    this.$element
      .css({
        left: `${this.dimensions.startX}px`,
        top: `${this.dimensions.startY}px`,
        width: "0px",
        transform: `rotate(${this.dimensions.angle}deg)`,
      })
      .addClass(this.type);

    if (this.isPathLine) {
      this.$element.addClass("path-line");
    }
  }

  /**
   * animates the line's width to create a drawing effect.
   */
  animate() {
    /**
     * executes a callback if it is a valid function.
     * @param {Function} callback
     */
    const callIfValid = (callback) => {
      if (typeof callback === "function") {
        callback();
      }
    };

    this.$element.animate(
      { width: `${this.dimensions.length}px` },
      {
        duration: 500 + Math.random() * 500,
        easing: "linear",
        complete: () => {
          if (!this.isPathLine) {
            setTimeout(() => {
              this.$element.addClass("fade");
              setTimeout(() => this.$element.remove(), 1000);
              callIfValid(this.onComplete);
            }, 100);
          } else {
            callIfValid(this.onComplete);
          }
        },
      }
    );
  }
}

/**
 * represents the graph structure of nodes and their connections.
 * @class
 * @property {Node[]} nodes - array of node instances.
 * @property {Map<number, { node: number, weight: number }[]>} adjacencyList
 */
class Graph {
  /**
   * creates a new Graph instance.
   * @param {Node[]} nodes - array of node instances.
   */
  constructor(nodes) {
    this.nodes = nodes;
    this.adjacencyList = new Map();
  }

  /**
   * builds the adjacency list for the graph based on node positions.
   */
  build() {
    this.nodes.forEach((node) => {
      this.adjacencyList.set(node.id, []);
    });
    const makeVertex = (id, weight) => ({ node: id, weight });
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeA = this.nodes[i];
        const nodeB = this.nodes[j];
        const distance = this.getDistance(nodeA.position, nodeB.position);
        this.adjacencyList.get(nodeA.id).push(makeVertex(nodeB.id, distance));
        this.adjacencyList.get(nodeB.id).push(makeVertex(nodeA.id, distance));
      }
    }
  }

  /**
   * calculates the euclidean distance between two points.
   * @param {Point} posA - the first point.
   * @param {Point} posB - the second point.
   * @returns {number} the distance between posA and posB.
   */
  getDistance(posA, posB) {
    const dX = posB.x - posA.x;
    const dY = posB.y - posA.y;
    return Math.sqrt(dX * dX + dY * dY);
  }

  /**
   * finds the shortest path between two nodes using dijkstra's algorithm.
   * @param {number} startId - the id of the start node.
   * @param {number} endId - the id of the end node.
   * @returns {number[]} array of node ids representing the shortest path.
   */
  dijkstras(startId, endId) {
    const distances = new Map();
    const previous = new Map();
    const queue = new Set();

    this.nodes.forEach((node) => {
      distances.set(node.id, Infinity);
      previous.set(node.id, null);
      queue.add(node.id);
    });

    distances.set(startId, 0);

    while (queue.size > 0) {
      let current = null;
      let smallest = Infinity;
      queue.forEach((nodeId) => {
        const dist = distances.get(nodeId);
        if (dist < smallest) {
          smallest = dist;
          current = nodeId;
        }
      });

      if (current === endId || smallest === Infinity) {
        break;
      }

      queue.delete(current);

      this.adjacencyList.get(current).forEach((neighbor) => {
        if (!queue.has(neighbor.node)) {
          return;
        }
        const alt = distances.get(current) + neighbor.weight;
        if (alt < distances.get(neighbor.node)) {
          distances.set(neighbor.node, alt);
          previous.set(neighbor.node, current);
        }
      });
    }

    const path = [];
    let current = endId;

    while (current !== null) {
      path.unshift(current);
      current = previous.get(current);
    }
    const resultsValid = distances.get(endId) !== Infinity;
    return resultsValid ? path : [];
  }
}

/**
 * animates the traversal of a path between two nodes.
 * @class
 * @property {NetworkCanvas} canvas - reference to the NetworkCanvas instance.
 */
class PathAnimator {
  /**
   * creates a new PathAnimator instance.
   * @param {NetworkCanvas} canvas - the NetworkCanvas instance.
   */
  constructor(canvas) {
    this.canvas = canvas;
  }

  /**
   * animates the path between two nodes.
   * @param {Node} startNode - the starting node.
   * @param {Node} endNode - the ending node.
   * @returns {Promise<void>} resolves when the animation is complete.
   */
  async animate(startNode, endNode) {
    try {
      const path = this.getPath(startNode, endNode);

      if (path.length === 0) {
        return;
      }

      const nodeMap = this.mapNodes();
      const fromNode = nodeMap.get(path[0]);
      const toNode = nodeMap.get(path[path.length - 1]);

      if (!fromNode || !toNode) {
        return;
      }

      await this.pulseNodes(fromNode, toNode);
      this.highlightPathNodes(path, nodeMap);

      await this.animateLines(path, nodeMap);
      await toNode.pulse(2);

      this.unhighlightPathNodes(path, nodeMap);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * retrieves the shortest path between two nodes.
   * @param {Node} startNode - the starting node.
   * @param {Node} endNode - the ending node.
   * @returns {number[]} array of node ids representing the shortest path.
   */
  getPath(startNode, endNode) {
    return this.canvas.graph.dijkstras(startNode.id, endNode.id);
  }

  /**
   * creates a map of node ids to node instances.
   * @returns {Map<number, Node>} map of node ids to node instances.
   */
  mapNodes() {
    const nodes = this.canvas.canvasNodes.getAll();
    return new Map(nodes.map((n) => [n.id, n]));
  }

  /**
   * pulses the origin and destination nodes for dijkstras.
   * @param {Node} fromNode -
   * @param {Node} toNode -
   * @returns {Promise<void>} resolves when pulsing is complete.
   */
  async pulseNodes(fromNode, toNode) {
    await fromNode.pulse(3);
    await toNode.pulse(3);
  }

  /**
   * highlights all nodes along the path.
   * @param {number[]} path - array of node ids representing the path.
   * @param {Map<number, Node>} nodeMap - map of node ids to node instances.
   */
  highlightPathNodes(path, nodeMap) {
    path.forEach((nodeId) => {
      const node = nodeMap.get(nodeId);
      if (node) {
        node.$element.addClass("path-node");
      }
    });
  }

  /**
   * animates the lines between consecutive nodes in the path.
   * @param {number[]} path - array of node ids representing the path.
   * @param {Map<number, Node>} nodeMap - map of node ids to node instances.
   * @returns {Promise<void>} resolves when all line animations are complete.
   */
  async animateLines(path, nodeMap) {
    for (let i = 0; i < path.length - 1; i++) {
      const currentNode = nodeMap.get(path[i]);
      const nextNode = nodeMap.get(path[i + 1]);
      if (currentNode && nextNode) {
        await this.canvas.animateLine(currentNode, nextNode, true);
      }
    }
  }

  /**
   * removes the highlight from all nodes along the path after a delay.
   * @param {number[]} path - array of node ids representing the path.
   * @param {Map<number, Node>} nodeMap - map of node ids to node instances.
   */
  unhighlightPathNodes(path, nodeMap) {
    setTimeout(() => {
      path.forEach((nodeId) => {
        const node = nodeMap.get(nodeId);
        if (node) {
          node.$element.removeClass("path-node");
        }
      });
    }, 500);
  }

  /**
   * handles errors that occur during path animation.
   * @param {Error} error - the error that occurred.
   */
  handleError(error) {
    console.error("error during path animation:", error);
  }
}

/**
 * manages the network canvas, including nodes, lines, and animations.
 * @class
 * @property {JQuery<HTMLElement>} $canvas - the jquery canvas element.
 * @property {{ width: number, height: number }} size - current size of the canvas.
 * @property {CanvasNodes} canvasNodes - instance managing all nodes on the canvas.
 * @property {Graph|null} graph - the graph structure of nodes.
 * @property {PathAnimator} pathAnimator - instance responsible for animating paths.
 */
class NetworkCanvas {
  /**
   * creates a new NetworkCanvas instance.
   * @param {JQuery<HTMLElement>} $canvas - the jquery canvas element.
   */
  constructor($canvas) {
    this.$canvas = $canvas;
    this.size = getCanvasSize($canvas);
    this.canvasNodes = new CanvasNodes(
      this.size,
      config.justifyNodes,
      config.nodeCount,
      $canvas
    );
    this.graph = null;
    this.pathAnimator = new PathAnimator(this);
  }

  /**
   * initializes the network canvas by building the graph and starting animations.
   */
  draw() {
    this.buildGraph();
    this.startAnimations();
    this.setupOverclock();
    this.setupPathAnimation();
    $(window).on("resize", () => this.resize());
  }

  /**
   * builds the graph based on current nodes.
   */
  buildGraph() {
    const nodes = this.canvasNodes.getAll();
    this.graph = new Graph(nodes);
    this.graph.build();
  }

  /**
   * creates and draws a line between two points.
   * @param {Point} start - the starting point of the line.
   * @param {Point} end - the ending point of the line.
   * @param {Function} onComplete - callback function upon animation completion.
   * @param {boolean} [isPathLine=false] - indicates if the line is part of a path.
   */
  createLine(start, end, onComplete, isPathLine = false) {
    const line = new CanvasLine(start, end, onComplete, isPathLine);
    this.$canvas.append(line.$element);
    line.draw();
  }

  /**
   * starts the primary animations of the network.
   */
  startAnimations() {
    /**
     * determines and triggers animation chances for a pair of nodes.
     * @param {Node} startNode - the starting node.
     * @param {Node} endNode - the ending node.
     */
    const animationChances = (startNode, endNode) => {
      if (probability(0.4)) {
        startNode.pulse(1, 300);
      }
      if (probability(0.2)) {
        startNode.ripple();
      }
      this.createLine(startNode.position, endNode.position, null);
    };

    /**
     * recursively animates random pairs of nodes.
     */
    const animate = () => {
      const [startNode, endNode] = this.canvasNodes.selectRandom(2);

      if (startNode && endNode) {
        animationChances(startNode, endNode);
      }
      setTimeout(animate, config.frequency + Math.random() * 200);
    };

    animate();
  }

  /**
   * sets up the overclock mechanism draw connections
   * between all nodes.
   */
  setupOverclock() {
    setInterval(() => {
      const isBiased = probability(overclockConfig.chance);
      if (!isBiased || overclockConfig.active) {
        return;
      }
      overclockConfig.active = true;
      this.overclock();
      setTimeout(() => {
        overclockConfig.active = false;
      }, overclockConfig.duration);
    }, overclockConfig.interval);
  }

  /**
   * executes the overclock by connecting a fraction of nodes.
   */
  overclock() {
    const nodesToConnect = Math.floor(
      this.canvasNodes.getAll().length * overclockConfig.fraction
    );
    for (let i = 0; i < nodesToConnect; i++) {
      const [node, targetNode] = this.canvasNodes.selectRandom(2);
      if (node && targetNode) {
        this.createLine(node.position, targetNode.position, null, false);
      }
    }
  }

  /**
   * resizes the canvas and updates node positions accordingly.
   */
  resize() {
    this.size = getCanvasSize(this.$canvas);
    this.canvasNodes.resizeAll(this.size, config.justifyNodes);
    this.buildGraph();
  }

  /**
   * sets up periodic path animations between random node pairs.
   */
  setupPathAnimation() {
    setInterval(() => {
      const [startNode, endNode] = this.canvasNodes.selectRandom(2);
      if (startNode && endNode) {
        this.pathAnimator.animate(startNode, endNode);
      }
    }, 15000);
  }

  /**
   * animates a line between two nodes.
   * @param {Node} currentNode - the starting node.
   * @param {Node} nextNode - the ending node.
   * @param {boolean} [isPathLine=false] - indicates if the line is part of a path.
   * @returns {Promise<void>} resolves when the line animation is complete.
   */
  animateLine(currentNode, nextNode, isPathLine = false) {
    return new Promise((resolve) => {
      this.createLine(
        currentNode.position,
        nextNode.position,
        resolve,
        isPathLine
      );
    });
  }

  /**
   * disables the network canvas by removing it from the dom.
   */
  static disable() {
    findCanvas().remove();
  }

  /**
   * finds and returns the network canvas element.
   * @returns {JQuery<HTMLElement>} the jquery canvas element.
   */
  static find() {
    return findCanvas();
  }
}

export { NetworkCanvas };
