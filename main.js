/*
 * TODO:
 * use priority queue instead of stupid loop
 */

var tileW = 32;
var tileH = 32;
var mapSide = 16;
var mapW = mapSide * tileW;
var mapH = mapSide * tileH;
var numObstacles = 8;

var controls = {
    showEdges: document.getElementById("show-edges"),
    randomStart: document.getElementById("random-start"),
    go: document.getElementById("go"),
};

function Node(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;

    this.centerX = this.x + this.w/2;
    this.centerY = this.y + this.h/2;

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
    link: function(node) {
        if (this.neighbors.indexOf(node) != -1)
            return;
        this.neighbors.push(node);
        node.neighbors.push(this);
    },
    detach: function() {
        // we need to copy neighbors via slice() because
        // unlink will remove elements from it
        this.neighbors.slice(0).forEach(this.unlink.bind(this));
    },
    unlink: function(node) {
        this.neighbors.splice(this.neighbors.indexOf(node), 1);
        node.neighbors.splice(node.neighbors.indexOf(this), 1);
    },
    distanceTo: function(node) {
        var dx = this.centerX - node.centerX;
        var dy = this.centerY - node.centerY;
        return Math.hypot(dx, dy);
    },
    manhattenDistanceTo: function(node) {
        return Math.abs(this.centerX - node.centerX) + Math.abs(this.centerY - node.centerY);
    },
    costTo: function(node) {
        return this.manhattenDistanceTo(node);
    },
    intersects: function(node) {
        return this.x < node.x + node.w && this.y < node.y + node.h &&
	    this.x + this.w > node.x && this.y + this.h > node.y;
    },
    touches: function(node) {
        return this.x <= node.x + node.w && this.y <= node.y + node.h &&
	    this.x + this.w >= node.x && this.y + this.h >= node.y;
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
            ctx.moveTo(this.centerX, this.centerY);
            ctx.lineTo(node.centerX, node.centerY);
            ctx.stroke();

            ctx.fillStyle = "#333";
            ctx.beginPath();
            ctx.arc(node.centerX, node.centerY, 2, 0, 2*Math.PI);
            ctx.fill();
        }.bind(this));
    }
};

function astar(start, goal) {
    if (start.intersects(goal))
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

        if (current.intersects(goal))
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

                this.add(node);
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
                ctx.moveTo(first.centerX, first.centerY);
                this.nodes.forEach(function(node) {
                    ctx.lineTo(node.centerX, node.centerY);
                });
                ctx.stroke();
                this.nodes.forEach(function(node) {
                    ctx.fillStyle = "#f00";
                    ctx.beginPath();
                    ctx.arc(node.centerX, node.centerY, 3, 0, 2*Math.PI);
                    ctx.fill();
                });
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
    subdivide: function(obstacle) {
        var nodes = this.findNodes(obstacle);
        // make 4 corners nodes
        // [nw]***[ne]
        //  *       *
        // [sw]***[se]
        var max = {x: -Infinity, y: -Infinity};
        var min = {x: +Infinity, y: +Infinity};
        nodes.forEach(function(node) {
            if (node.x + node.w > max.x)
                max.x = node.x + node.w;
            if (node.y + node.h > max.y)
                max.y = node.y + node.h;

            if (node.x < min.x)
                min.x = node.x;
            if (node.y < min.y)
                min.y = node.y;
        });

        var nw = new Node(min.x, min.y, obstacle.x - min.x, obstacle.y - min.y);

        var width = max.x - (obstacle.x + obstacle.w);
        var ne = new Node(max.x - width, min.y, width, nw.h);

        var height = max.y - (obstacle.y + obstacle.h);
        var sw = new Node(min.x, max.y - height, nw.w, height);

        var se = new Node(ne.x, sw.y, ne.w, sw.h);

        // next
        //  ***[n]***
        //  *       *
        // [w]     [e]
        //  *       *
        //  ***[s]***

        width = (max.x - min.x) - (nw.w + ne.w);
        var n = new Node(nw.x + nw.w, nw.y, width, ne.h);

        height = (max.y - min.y) - (nw.h + sw.h);
        var w = new Node(nw.x, nw.y + nw.h, nw.w, height);

        var s = new Node(sw.x + sw.w, sw.y, width, sw.h);

        var e = new Node(se.x, w.y, ne.w, height);

        var subnodes = [
            nw, n, ne,
            w, /**/, e,
            sw, s, se,
        ];
        w.link(nw);
        w.link(sw);
        e.link(ne);
        e.link(se);
        n.link(nw);
        n.link(ne);
        s.link(sw);
        s.link(se);

        nodes.forEach(function(node) {
            subnodes.forEach(function(subnode) {
                if (node.intersects(subnode)) {
                    node.neighbors.forEach(function(neighbor) {
                        if (nodes.indexOf(neighbor) != -1)
                            return;
                        if (subnode.touches(neighbor)) {
                            subnode.link(neighbor);
                        }
                    });
                }
            });
            graph.remove(node);
        });

        subnodes.forEach(function(subnode) {
            if (subnode.w == 0 || subnode.h == 0)
                subnode.detach();
            else
                this.add(subnode);
        }.bind(this));
    },
    add: function(node) {
        this.nodes.push(node);
    },
    remove: function(node) {
        node.detach();
        var i = this.nodes.indexOf(node);
        this.nodes.splice(i, 1);
    },
    addObstacle: function(obstacle) {
        this.obstacles.push(obstacle);
        this.subdivide(obstacle);
    },
    findNodes: function(obstacle) {
        return this.nodes.filter(function(node) {
            return node.intersects(obstacle);
        });
    },
};

function Obstacle(x, y, w, h) {
    var node = new Node(x, y, w, h);
    node.color = "rgba(0, 0, 0, 0.5)";
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
var start = null;
var goal = null;

function go() {
    graph.init();
    generateObstacles();
    initStartAndGoal();
    graph.findPath(start, goal);
    redraw();
}

function generateObstacles() {
    for (var i = 0; i < numObstacles; ) {
        var w = rand(8, 3*tileW);
        var h = rand(8, 3*tileH);
        var x = rand(0, mapSide*tileW - w);
        var y = rand(0, mapSide*tileH - h);
        var obstacle = new Obstacle(x, y, w, h);
        if (graph.obstacles.some(function(ob) {
            return obstacle.intersects(ob);
        })) {
            continue;
        }
        graph.addObstacle(obstacle);
        i++;
    }
}

function initStartAndGoal() {
    if (controls.randomStart.checked) {
        start = graph.nodes[rand(0, graph.nodes.length)];
        goal = graph.nodes[rand(0, graph.nodes.length)];
    } else {
        start = graph.nodes[0];
        goal = graph.nodes[graph.nodes.length-1];
    }

    goal.color = "#0c0";
    start.color = "#f00";
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
