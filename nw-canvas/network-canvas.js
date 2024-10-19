// network-canvas.js

import { Point } from "./point.js";

// Enums
const NodeStatus = {
  IDLE: "idle",
  ACTIVE: "active",
  SENDING: "sending",
};

const LineType = {
  DOTTED: "dotted",
  SOLID: "solid",
};

// Helper functions
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
  if (nodes.length < 2) return null;
  const randomNode = () =>
    nodes[Math.floor(Math.random() * nodes.length)].position;
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
    this.status = NodeStatus.IDLE;
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

  setStatus(status) {
    this.status = status;
    this.$element
      .removeClass(Object.values(NodeStatus).join(" "))
      .addClass(status);
  }

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

  updatePosition(newPosition) {
    this.position = newPosition;
    this.$element.css({
      left: `${this.position.x}px`,
      top: `${this.position.y}px`,
    });
  }

  addRipple() {
    const $ripple = $('<div class="ripple-effect"></div>');
    this.$element.append($ripple);
    setTimeout(() => $ripple.remove(), 1000);
  }
}

class CanvasLine {
  constructor(start, end, onComplete, isPathLine = false) {
    this.$element = $('<div class="line"></div>');
    this.dimensions = getLineDimensions(start, end);
    this.type = Math.random() < 0.5 ? LineType.DOTTED : LineType.SOLID;
    this.onComplete = onComplete;
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
      .addClass(this.type);

    if (this.isPathLine) {
      this.$element.addClass("path-line");
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
    this.nodes.forEach((node) => this.adjacencyList.set(node.id, []));
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

      if (current === endId || smallest === Infinity) break;

      queue.delete(current);

      this.adjacencyList.get(current).forEach((neighbor) => {
        if (!queue.has(neighbor.node)) return;
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

    return distances.get(endId) === Infinity ? [] : path;
  }
}

class NetworkAnimator {
  constructor(canvas) {
    this.canvas = canvas;
    this.animationQueue = [];
    this.isAnimating = false;
  }

  enqueueAnimation(startNode, endNode) {
    this.animationQueue.push({ start: startNode, end: endNode });
    this.processQueue();
  }

  processQueue() {
    if (this.isAnimating || this.animationQueue.length === 0) return;
    const { start, end } = this.animationQueue.shift();
    this.isAnimating = true;
    this.animatePath(start, end, () => {
      this.isAnimating = false;
      this.processQueue();
    });
  }

  async animatePath(startNode, endNode, callback) {
    const path = this.canvas.graph.runDijkstras(startNode.id, endNode.id);
    if (path.length === 0) {
      if (callback) callback();
      return;
    }

    const nodeMap = new Map(this.canvas.nodes.map((n) => [n.id, n]));
    const originNode = nodeMap.get(path[0]);
    const destinationNode = nodeMap.get(path[path.length - 1]);

    if (!originNode || !destinationNode) {
      if (callback) callback();
      return;
    }

    try {
      await originNode.pulse(3);
      await destinationNode.pulse(3);

      path.forEach((nodeId) => {
        const node = nodeMap.get(nodeId);
        if (node) node.$element.addClass("path-node");
      });

      for (let i = 0; i < path.length - 1; i++) {
        const currentNode = nodeMap.get(path[i]);
        const nextNode = nodeMap.get(path[i + 1]);
        if (currentNode && nextNode) {
          await this.canvas.animateLine(currentNode, nextNode, true);
        }
      }

      await destinationNode.pulse(2);

      setTimeout(() => {
        path.forEach((nodeId) => {
          const node = nodeMap.get(nodeId);
          if (node) node.$element.removeClass("path-node");
        });
        if (callback) callback();
      }, 500);
    } catch (error) {
      console.error("Error during path animation:", error);
      if (callback) callback();
    }
  }
}

class NetworkCanvas {
  constructor($canvas) {
    this.$canvas = $canvas;
    this.size = getCanvasSize($canvas);
    this.nodes = [];
    this.graph = null;
    this.animator = new NetworkAnimator(this);
    this.config = {
      nodeCount: 250,
      frequency: 500,
      justifyNodes: "random",
    };
    this.overclockConfig = {
      active: false,
      interval: 5000,
      duration: 5000,
      chance: 0.25,
      fraction: 0.75,
    };
  }

  init() {
    this.createNodes();
    this.buildGraph();
    this.startAnimations();
    this.setupOverclock();
    this.setupPathAnimation();
    $(window).on("resize", () => this.resize());
  }

  createNodes() {
    for (let i = 0; i < this.config.nodeCount; i++) {
      const node = new Node(this.size, this.config.justifyNodes, i);
      this.$canvas.append(node.$element);
      this.nodes.push(node);
    }
  }

  buildGraph() {
    this.graph = new Graph(this.nodes);
  }

  createLine(start, end, onComplete, isPathLine = false) {
    const line = new CanvasLine(start, end, onComplete, isPathLine);
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
          if (startNode) startNode.addRipple();
        }
        this.createLine(positions.start, positions.end, null);
      }
      setTimeout(animate, this.config.frequency + Math.random() * 200);
    };
    animate();
  }

  setupOverclock() {
    setInterval(() => {
      const isBiased = Math.random() < this.overclockConfig.chance;
      if (isBiased && !this.overclockConfig.active) {
        this.overclockConfig.active = true;
        this.overclock();
        setTimeout(() => {
          this.overclockConfig.active = false;
        }, this.overclockConfig.duration);
      }
    }, this.overclockConfig.interval);
  }

  overclock() {
    const nodesToConnect = Math.floor(
      this.nodes.length * this.overclockConfig.fraction
    );
    for (let i = 0; i < nodesToConnect; i++) {
      const [node, targetNode] = this.getRandomNodes(2);
      if (node && targetNode) {
        this.createLine(node.position, targetNode.position, null, false);
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
        this.config.justifyNodes
      );
      node.updatePosition(newPosition);
    });
    this.buildGraph();
  }

  setupPathAnimation() {
    setInterval(() => {
      const [startNode, endNode] = this.getRandomNodes(2);
      if (startNode && endNode) {
        this.animator.enqueueAnimation(startNode, endNode);
      }
    }, 15000);
  }

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

  static disable() {
    findCanvas().remove();
  }

  static find() {
    return findCanvas();
  }
}

export { NetworkCanvas };
