/*
 * TODO:
 * use priority queue instead of stupid loop
 * make nodes subdivision when adding obstacles
 */

var tileW = 32;
var tileH = 32;
var mapSide = 16;
var mapW = mapSide * tileW;
var mapH = mapSide * tileH;
var numObstacles = 8;

var controls = {
    showEdges: document.getElementById("show-edges"),
    randomStartGoal: document.getElementById("random-start-goal"),
    go: document.getElementById("go"),
};

function Node(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.neighbors = [];

    this.parent = null;
    this.visited = false;

    this.g = 0;
    this.f = 0;
    this.color = "#fff";
}

Node.prototype = {
    get key() {
        return this.x + "," + this.y;
    },
    equals: function(node) {
        var e = 1e-6;
        return Math.abs(this.x - node.x) < e && Math.abs(this.y - node.y) < e;
    },
    link: function(node) {
        if (this.neighbors.indexOf(node) != -1)
            return;
        this.neighbors.push(node);
        node.link(this);
    },
    detach: function() {
        // we need to copy neighbors via slice() because
        // unlink will remove elements from it
        this.neighbors.slice(0).forEach(this.unlink.bind(this));
    },
    unlink: function(node) {
        var i = this.neighbors.indexOf(node);
        if (i == -1)
            return;
        this.neighbors.splice(i, 1);
        node.unlink(this);
    },
    distanceTo: function(node) {
        var dx = this.x - node.x;
        var dy = this.y - node.y;
        return Math.hypot(dx, dy);
    },
    manhattenDistanceTo: function(node) {
        return Math.abs(this.x - node.x) + Math.abs(this.y - node.y);
    },
    costTo: function(node) {
        return this.manhattenDistanceTo(node);
    },
    intersects: function(node) {
        return this.x < node.x+node.w && this.y < node.y+node.h &&
	    this.x+this.w > node.x && this.y+this.h > node.y;
    },
    path: function() {
        var path = [this];
        var current = this.parent;
        while (current) {
            path.push(current);
            current = current.parent;
        }
        return path;
    },
    draw: function() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeStyle = "#333";
        ctx.strokeRect(this.x, this.y, this.w, this.h);

        // print some stuff
        // ctx.fillStyle = "#000";
        // ctx.fillText(this.key, this.x, this.y+this.h/2);
    },
    drawEdges: function() {
        this.neighbors.forEach(function(node) {
            ctx.strokeStyle = "#ccc";
            ctx.beginPath();
            ctx.moveTo(this.x + this.w/2, this.y + this.h/2);
            ctx.lineTo(node.x + node.h/2, node.y + node.h/2);
            ctx.stroke();

            ctx.fillStyle = "#333";
            ctx.beginPath();
            ctx.arc(node.x + node.h/2, node.y + node.h/2, 2, 0, 2*Math.PI);
            ctx.fill();
        }.bind(this));
    }
};

function astar(start, goal) {
    if (start.equals(goal))
        return [];

    var openset = {};
    openset[start.key] = start;
    var opensetLength = 1;

    start.f = start.g + start.costTo(goal);

    while (opensetLength > 0) {
        var current = {f: +Infinity};
        for(var i in openset) {
            if (current.f > openset[i].f)
                current = openset[i];
        }

        if (current.equals(goal))
            return current.path();

        delete openset[current.key];
        opensetLength--;

        current.visited = true;
        current.neighbors.forEach(function(neighbor) {
            if (neighbor.visited)
                return;
            var g = current.g + current.distanceTo(neighbor);
            var inOpen = neighbor.key in openset;
            if (!inOpen || g < neighbor.g) {
                neighbor.parent = current;
                neighbor.g = g;
                neighbor.f = g + neighbor.costTo(goal);
                if (!inOpen) {
                    openset[neighbor.key] = neighbor;
                    opensetLength++;
                }
            }
        });
    }
    return [];
}

function Graph() {}

Graph.prototype = {
    nodes: [],
    obstacles: [],
    path: [],
    init: function() {
        this.nodes = [];
        this.obstacles = [];
        var i = 0;
        for (var y = 0; y < mapW; y += tileH) {
            for (var x = 0; x < mapW; x += tileW) {
                var node = new Node(x, y, tileW, tileH);
                if (x > 0)
                    node.link(this.nodes[i-1]);
                if (y > 0) {
                    if (x > 0)
                        node.link(this.nodes[i-mapSide-1]);

                    node.link(this.nodes[i-mapSide]);

                    if (x < mapW-tileW)
                        node.link(this.nodes[i-mapSide+1]);
                }

                this.nodes.push(node);
                i++;
            }
        }
    },
    findPath: function(start, goal) {
        this.path = {
            nodes: astar(start, goal),
            draw: function() {
                if (this.nodes.length == 0)
                    return;
                var first = this.nodes[0];
                ctx.strokeStyle = "#f00";
                ctx.beginPath();
                ctx.moveTo(first.x + first.w/2, first.y + first.h/2);
                this.nodes.forEach(function(node) {
                    ctx.lineTo(node.x + node.h/2, node.y + node.h/2);
                });
                ctx.stroke();
            },
        };
        return this.path;
    },
    draw: function() {
        function draw(obj) {
            obj.draw();
        }
        this.nodes.forEach(draw);
        if (controls.showEdges.checked) {
            this.nodes.forEach(function(node) {
                node.drawEdges();
            });
        }
        this.obstacles.forEach(draw);

        this.path.draw();
    },
    addObstacle: function(obstacle) {
        this.obstacles.push(obstacle);
        this.findNodes(obstacle).forEach(function(node) {
            node.color = "rgba(255, 0, 0, 0.5)";
            node.detach();
        });
    },
    findNodes: function(obstacle) {
        return this.nodes.filter(function(node) {
            return node.intersects(obstacle);
        });
    },
};

function Obstacle(x, y, w, h) {
    var node = new Node(x, y, w, h);
    node.color = "#555";
    return node;
}

var canvas = document.getElementById("canvas");
canvas.width = mapW;
canvas.height = mapH;
var ctx = canvas.getContext("2d");

// rand returns random number in [min, max)
function rand(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
};

var graph = new Graph();
var path = [];
function go() {
    graph.init();
    generateObstacles();
    findPath();
    redraw();
}

function generateObstacles() {
    for (var i = 0; i < numObstacles; i++) {
        var w = rand(8, 3*tileW);
        var h = rand(8, 3*tileH);
        var x = rand(0, mapSide*tileW - w);
        var y = rand(0, mapSide*tileH - h);
        graph.addObstacle(new Obstacle(x, y, w, h));
    }
}

function findPath() {
    if (controls.randomStartGoal.checked) {
        var start = graph.nodes[rand(0, graph.nodes.length)];
        var goal = graph.nodes[rand(0, graph.nodes.length)];
    } else {
        start = graph.nodes[0];
        goal = graph.nodes[graph.nodes.length-1];
    }

    goal.color = "#0c0";
    start.color = "#f00";

    graph.findPath(start, goal);
}

function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    graph.draw();
}


for (var i in controls) {
    var control = controls[i];
    if (control.dataset.redrawOnly)
        control.onclick = redraw;
    else
        control.onclick = go;
}

go();
