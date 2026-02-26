const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const winnerText = document.getElementById('winner-text');
const p1Hearts = document.getElementById('p1-hearts');
const p2Hearts = document.getElementById('p2-hearts');

// Set canvas size
canvas.width = 1000;
canvas.height = 700;

const COLORS = {
    p1: '#2ecc71',
    p1Dark: '#27ae60',
    p2: '#e74c3c',
    p2Dark: '#c0392b',
    cupcake: '#ff85a2',
    frosting: '#ffffff',
    sprinkles: ['#f1c40f', '#9b59b6', '#3498db'],
    obstacle: '#f39c12'
};

const keys = {};

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

class Bullet {
    constructor(x, y, angle, owner) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = 7;
        this.radius = 8;
        this.owner = owner;
        this.active = true;
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        // Wall collision
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            this.active = false;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2);

        // Cupcake base
        ctx.fillStyle = '#d35400';
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.lineTo(4, 5);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fill();

        // Frosting
        ctx.fillStyle = COLORS.cupcake;
        ctx.beginPath();
        ctx.arc(0, -2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.frosting;
        ctx.beginPath();
        ctx.arc(0, -4, 3, 0, Math.PI * 2);
        ctx.fill();

        // Sprinkles
        COLORS.sprinkles.forEach((s, i) => {
            ctx.fillStyle = s;
            ctx.fillRect((i - 1) * 2, -4, 1, 1);
        });

        ctx.restore();
    }
}

class Tank {
    constructor(x, y, color, controls, id) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.color = color;
        this.controls = controls;
        this.hp = 3;
        this.radius = 25;
        this.speed = 3;
        this.rotationSpeed = 0.05;
        this.bullets = [];
        this.lastShot = 0;
        this.cooldown = 500;
    }

    update(obstacles, enemy) {
        if (this.hp <= 0) return;

        let nextX = this.x;
        let nextY = this.y;
        let nextAngle = this.angle;

        if (keys[this.controls.forward]) {
            nextX += Math.cos(this.angle) * this.speed;
            nextY += Math.sin(this.angle) * this.speed;
        }
        if (keys[this.controls.backward]) {
            nextX -= Math.cos(this.angle) * (this.speed * 0.5);
            nextY -= Math.sin(this.angle) * (this.speed * 0.5);
        }
        if (keys[this.controls.left]) {
            nextAngle -= this.rotationSpeed;
        }
        if (keys[this.controls.right]) {
            nextAngle += this.rotationSpeed;
        }

        // Collision with walls
        if (nextX > this.radius && nextX < canvas.width - this.radius &&
            nextY > this.radius && nextY < canvas.height - this.radius) {

            // Collision with obstacles
            let hit = false;
            for (let obs of obstacles) {
                if (nextX + this.radius > obs.x && nextX - this.radius < obs.x + obs.w &&
                    nextY + this.radius > obs.y && nextY - this.radius < obs.y + obs.h) {
                    hit = true;
                    break;
                }
            }

            // Collision with enemy tank
            const dx = nextX - enemy.x;
            const dy = nextY - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.radius * 2) hit = true;

            if (!hit) {
                this.x = nextX;
                this.y = nextY;
            }
        }
        this.angle = nextAngle;

        // Shooting
        if (keys[this.controls.shoot] && Date.now() - this.lastShot > this.cooldown) {
            this.bullets.push(new Bullet(
                this.x + Math.cos(this.angle) * 35,
                this.y + Math.sin(this.angle) * 35,
                this.angle,
                this.id
            ));
            this.lastShot = Date.now();
        }

        // Update bullets
        this.bullets = this.bullets.filter(b => b.active);
        this.bullets.forEach(b => {
            b.update();

            // Check collision with obstacles
            for (let obs of obstacles) {
                if (b.x > obs.x && b.x < obs.x + obs.w && b.y > obs.y && b.y < obs.y + obs.h) {
                    createExplosion(b.x, b.y, COLORS.obstacle);
                    b.active = false;
                }
            }

            // Check collision with enemy
            const dx = b.x - enemy.x;
            const dy = b.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < enemy.radius) {
                createExplosion(b.x, b.y, enemy.color);
                enemy.hit();
                b.active = false;
            }
        });
    }

    hit() {
        this.hp--;
        updateHearts();
        if (this.hp <= 0) {
            endGame(this.id === 1 ? 2 : 1);
        }
    }

    draw() {
        if (this.hp <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        // Tank Body
        ctx.fillStyle = this.color;
        ctx.fillRect(-20, -20, 40, 40);

        // Tracks
        ctx.fillStyle = '#333';
        ctx.fillRect(-22, -22, 44, 10);
        ctx.fillRect(-22, 12, 44, 10);

        // Turret
        ctx.fillStyle = this.id === 1 ? COLORS.p1Dark : COLORS.p2Dark;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        // Barrel
        ctx.fillStyle = this.color;
        ctx.fillRect(10, -5, 25, 10);

        ctx.restore();

        // Draw bullets
        this.bullets.forEach(b => b.draw());
    }
}

class Obstacle {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    draw() {
        ctx.fillStyle = COLORS.obstacle;
        ctx.fillRect(this.x, this.y, this.w, this.h);

        // Sugar cube effect
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.strokeRect(this.x, this.y, this.w, this.h);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(this.x, this.y, this.w, 4);
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.friction = 0.95;
    }

    update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.02;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

let particles = [];

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

let p1, p2, obstacles;
let gameActive = true;

function init() {
    p1 = new Tank(100, canvas.height / 2, COLORS.p1, {
        forward: 'KeyW', backward: 'KeyS', left: 'KeyA', right: 'KeyD', shoot: 'Space'
    }, 1);

    p2 = new Tank(canvas.width - 100, canvas.height / 2, COLORS.p2, {
        forward: 'ArrowUp', backward: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', shoot: 'Enter'
    }, 2);
    p2.angle = Math.PI;

    obstacles = [
        new Obstacle(200, 150, 40, 400),
        new Obstacle(canvas.width - 240, 150, 40, 400),
        new Obstacle(400, 100, 200, 40),
        new Obstacle(400, canvas.height - 140, 200, 40),
        new Obstacle(480, 300, 40, 100)
    ];

    particles = [];
    updateHearts();
    overlay.classList.add('hidden');
    gameActive = true;
    requestAnimationFrame(loop);
}

function updateHearts() {
    p1Hearts.innerText = '❤️'.repeat(Math.max(0, p1.hp));
    p2Hearts.innerText = '❤️'.repeat(Math.max(0, p2.hp));
}

function endGame(winner) {
    gameActive = false;
    winnerText.innerText = `Jogador ${winner} Venceu!`;
    winnerText.style.background = `linear-gradient(45deg, ${winner === 1 ? COLORS.p1 : COLORS.p2}, #fff)`;
    winnerText.style.webkitBackgroundClip = 'text';
    overlay.classList.remove('hidden');
}

function resetGame() {
    init();
}

function loop() {
    if (!gameActive) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for (let j = 0; j < canvas.height; j += 50) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvas.width, j); ctx.stroke();
    }

    // Update
    p1.update(obstacles, p2);
    p2.update(obstacles, p1);

    particles.forEach((p, i) => {
        p.update();
        if (p.alpha <= 0) particles.splice(i, 1);
    });

    // Draw
    obstacles.forEach(o => o.draw());
    p1.draw();
    p2.draw();
    particles.forEach(p => p.draw());

    requestAnimationFrame(loop);
}

init();
