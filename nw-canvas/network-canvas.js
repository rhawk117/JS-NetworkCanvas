// network-canvas.js

// god help me what have I created
import { Point } from "./point.js";
export { NetworkCanvas };

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

const getCanvasSize = ($canvas) => ({
  width: $canvas.width(),
  height: $canvas.height(),
});

const findCanvas = () => {
  const $canvas = $("#networkCanvas");
  if (!$canvas.length) {
    throw new Error("CanvasError: Canvas not found");
  }
  return $canvas;
};

const getRandomNodePositions = (nodes) => {
  if (nodes.length < 2) {
    return null;
  }
  const randomNode = () => {
    const randIndex = Math.floor(Math.random() * nodes.length);
    return nodes[randIndex].position;
  };
  const start = randomNode();
  let end = randomNode();

  while (start.x === end.x && start.y === end.y) {
    end = randomNode();
  }
  return { start, end };
};

class Node {
  constructor(size, justification, id) {
    this.id = id;
    this.position = new Point(size.width, size.height, justification);
    this.isActive = false;
    this.isSending = false;
    this.$element = this.create();
  }

  create() {
    return $('<div class="node blink ripple"></div>')
      .css({
        left: `${this.position.x}px`,
        top: `${this.position.y}px`,
      })
      .attr("data-id", this.id);
  }

  blink() {
    this.$element.addClass("active");
    setTimeout(() => this.$element.removeClass("active"), 300);
  }

  /**
   * @param {number} times - Number of times to pulse.
   * @param {number} interval - Interval between pulses in milliseconds.
   * @returns {Promise} - Resolves when all pulses are complete.
   */
  pulse(times = 1, interval = 300) {
    return new Promise((resolve) => {
      let count = 0;

      const doPulse = () => {
        if (count < times) {
          this.$element.addClass("active");
          setTimeout(() => {
            this.$element.removeClass("active");
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

  pulseThreeTimes() {
    return this.pulse(3, 300);
  }

  pulseTwoTimes() {
    return this.pulse(2, 300);
  }

  setSending(state) {
    this.isSending = state;
    this.$element.toggleClass("blink", !state);
  }

  updatePosition(newPosition) {
    this.position = newPosition;
    this.$element.css({
      left: `${this.position.x}px`,
      top: `${this.position.y}px`,
    });
  }
}

/**
 * @class CanvasLine
 */
class CanvasLine {
  constructor(start, end, onComplete, isOverclock = false, isPathLine = false) {
    this.$element = $('<div class="line"></div>');
    this.dimensions = getLineDimensions(start, end);
    this.isDotted = Math.random() < 0.5;
    this.onComplete = onComplete;
    this.isOverclock = isOverclock;
    this.isPathLine = isPathLine;
  }

  init() {
    this.style();
    this.animate();
  }

  style() {
    this.$element
      .css({
        left: `${this.dimensions.startX}px`,
        top: `${this.dimensions.startY}px`,
        width: "0px",
        transform: `rotate(${this.dimensions.angle}deg)`,
      })
      .addClass(this.isDotted ? "dotted" : "solid");

    if (this.isPathLine) {
      this.$element.addClass("path-line"); // For CSS styling of path lines
    }
  }

  animate() {
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
              if (typeof this.onComplete === "function") this.onComplete();
            }, 100);
          } else {
            // For path lines, resolve immediately without fading
            if (typeof this.onComplete === "function") this.onComplete();
          }
        },
      }
    );
  }
}

class Graph {
  constructor(nodes) {
    this.nodes = nodes;
    this.adjacencyList = new Map();
    this.buildGraph();
  }

  buildGraph() {
    this.nodes.forEach((node) => {
      this.adjacencyList.set(node.id, []);
    });

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeA = this.nodes[i];
        const nodeB = this.nodes[j];
        const distance = this.calculateDistance(nodeA.position, nodeB.position);
        this.adjacencyList
          .get(nodeA.id)
          .push({ node: nodeB.id, weight: distance });
        this.adjacencyList
          .get(nodeB.id)
          .push({ node: nodeA.id, weight: distance });
      }
    }
  }

  calculateDistance(posA, posB) {
    const dX = posB.x - posA.x;
    const dY = posB.y - posA.y;
    return Math.sqrt(dX * dX + dY * dY);
  }

  runDijkstras(startId, endId) {
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

    if (distances.get(endId) === Infinity) {
      return [];
    } else {
      return path;
    }
  }
}

const config = {
  nodeCount: 50,
  frequency: 1000,
  justifyNodes: "corner", // "center", "corner", "random"
};

const overclockConfig = {
  active: false,
  interval: 10000,
  duration: 5000,
  chance: 0.25,
  fraction: 0.75,
};

class NetworkCanvas {
  constructor($canvas) {
    this.$canvas = $canvas;
    this.size = getCanvasSize($canvas);
    this.nodes = [];
    this.graph = null;
    this.pathAnimationQueue = [];
    this.isAnimatingPath = false;
  }

  init() {
    this.createNodes();
    this.buildGraph();
    this.startAnimations();
    this.setupOverclock();
    this.setupDrawPathAnimation();
    $(window).on("resize", () => this.resize());
  }

  createNodes() {
    for (let i = 0; i < config.nodeCount; i++) {
      const node = new Node(this.size, config.justifyNodes, i);
      this.$canvas.append(node.$element);
      this.nodes.push(node);
    }
  }

  buildGraph() {
    this.graph = new Graph(this.nodes);
    console.log("Graph built with adjacency list:", this.graph.adjacencyList);
  }

  createLine(start, end, onComplete, isOverclock = false, isPathLine = false) {
    const line = new CanvasLine(
      start,
      end,
      onComplete,
      isOverclock,
      isPathLine
    );
    this.$canvas.append(line.$element);
    line.init();
  }

  startAnimations() {
    const animate = () => {
      const positions = getRandomNodePositions(this.nodes);
      if (positions) {
        if (Math.random() < 0.4) {
          const startNode = this.nodes.find(
            (n) =>
              n.position.x === positions.start.x &&
              n.position.y === positions.start.y
          );
          if (startNode) startNode.pulse(1, 300);
        }
        if (Math.random() < 0.2) {
          const startNode = this.nodes.find(
            (n) =>
              n.position.x === positions.start.x &&
              n.position.y === positions.start.y
          );
          if (startNode) startNode.blink();
        }
        this.createLine(positions.start, positions.end, null);
      }
      setTimeout(animate, config.frequency + Math.random() * 200);
    };
    animate();
  }

  setupOverclock() {
    setInterval(() => {
      const isBiased = Math.random() < overclockConfig.chance;
      if (isBiased && !overclockConfig.active) {
        overclockConfig.active = true;
        this.overclock();
        setTimeout(() => {
          overclockConfig.active = false;
        }, overclockConfig.duration);
      }
    }, overclockConfig.interval);
  }

  overclock() {
    const nodesToConnect = Math.floor(
      this.nodes.length * overclockConfig.fraction
    );
    for (let i = 0; i < nodesToConnect; i++) {
      const [node, targetNode] = this.getRandomNodes(2);
      if (node && targetNode) {
        this.createLine(node.position, targetNode.position, null, true); // Overclock lines fade out as regular lines
      }
    }
  }

  getRandomNodes(count, exclusions = []) {
    const availableNodes = this.nodes.filter(
      (node) => !exclusions.includes(node)
    );
    return availableNodes.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  resize() {
    this.size = getCanvasSize(this.$canvas);
    this.nodes.forEach((node) => {
      const newPosition = new Point(
        this.size.width,
        this.size.height,
        config.justifyNodes
      );
      node.updatePosition(newPosition);
    });
    this.buildGraph();
  }

  setupDrawPathAnimation() {
    setInterval(() => {
      const [startNode, endNode] = this.getRandomNodes(2);
      if (startNode && endNode) {
        this.enqueuePathAnimation(startNode, endNode);
      }
    }, 15000);
  }

  enqueuePathAnimation(startNode, endNode) {
    this.pathAnimationQueue.push({ start: startNode, end: endNode });
    this.processPathQueue();
  }

  processPathQueue() {
    if (this.isAnimatingPath || this.pathAnimationQueue.length === 0) {
      return;
    }

    const { start, end } = this.pathAnimationQueue.shift();
    this.isAnimatingPath = true;
    this.drawPath(start, end, () => {
      this.isAnimatingPath = false;
      this.processPathQueue();
    });
  }

  /**
   * @param {Node} startNode - the origin node.
   * @param {Node} endNode - the destination node.
   * @param {Function} callback - once animation is complete.
   */
  async drawPath(startNode, endNode, callback) {
    const path = this.graph.runDijkstras(startNode.id, endNode.id);

    if (path.length === 0) {
      if (callback) {
        callback();
      }
      return;
    }

    const originNode = this.nodes.find((n) => n.id === path[0]);
    const destinationNode = this.nodes.find(
      (n) => n.id === path[path.length - 1]
    );

    if (!originNode || !destinationNode) {
      if (callback) {
        callback();
      }
      return;
    }

    try {
      await originNode.pulseThreeTimes();

      await destinationNode.pulseThreeTimes();

      path.forEach((nodeId) => {
        const node = this.nodes.find((n) => n.id === nodeId);
        if (node) node.$element.addClass("path-node");
      });

      for (let i = 0; i < path.length - 1; i++) {
        const currentNode = this.nodes.find((n) => n.id === path[i]);
        const nextNode = this.nodes.find((n) => n.id === path[i + 1]);

        if (currentNode && nextNode) {
          await this.animateLine(currentNode, nextNode, true);
        }
      }

      await destinationNode.pulseTwoTimes();

      setTimeout(() => {
        path.forEach((nodeId) => {
          const node = this.nodes.find((n) => n.id === nodeId);
          if (node) {
            node.$element.removeClass("path-node");
          }
        });
        if (callback) {
          callback();
        }
      }, 500);
    } catch (error) {
      console.error("Error during path animation:", error);
      if (callback) {
        callback();
      }
    }
  }

  /**
   * Animates a line between two nodes and returns a Promise that resolves when animation is complete.
   * @param {Node} currentNode - The starting node.
   * @param {Node} nextNode - The ending node.
   * @param {boolean} isPathLine - Indicates if the line is part of Dijkstra's path.
   * @returns {Promise} - Resolves when the line animation is complete.
   */
  animateLine(currentNode, nextNode, isPathLine = false) {
    return new Promise((resolve) => {
      const line = new CanvasLine(
        currentNode.position,
        nextNode.position,
        () => {
          resolve();
        },
        false,
        isPathLine
      ); // isOverclock=false
      this.$canvas.append(line.$element);
      line.init();
    });
  }

  static disable() {
    findCanvas().remove();
  }

  static find() {
    return findCanvas();
  }
}
